let uploadedFiles = [];
let currentPlayingIndex = -1;
let mergedAudioBlob = null;
let downloadLink = '';

function addToPlaylist() {
    const fileInput = document.getElementById('fileInput');
    const statusText = document.getElementById('status');
    const mergeBtn = document.getElementById('mergeBtn');

    if (fileInput.files.length === 0) {
        statusText.textContent = "لطفا حداقل یک فایل صوتی انتخاب کنید.";
        statusText.style.color = '#ff4757';
        return;
    }

    for (let i = 0; i < fileInput.files.length; i++) {
        const file = fileInput.files[i];
        if (file.type.startsWith('audio/')) {
            uploadedFiles.push(file);
        }
    }

    statusText.textContent = `تعداد ${fileInput.files.length} فایل به لیست اضافه شد!`;
    statusText.style.color = '#4CAF50';

    if (uploadedFiles.length >= 2) {
        mergeBtn.disabled = false;
    }

    updatePlaylist();
    fileInput.value = '';
}

function updatePlaylist() {
    const playlistElement = document.getElementById('playlist');
    playlistElement.innerHTML = '';

    uploadedFiles.forEach((file, index) => {
        const listItem = document.createElement('li');
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.textContent = `${index + 1}. ${file.name}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'حذف';
        removeBtn.className = 'remove-btn';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeFromPlaylist(index);
        };

        listItem.appendChild(fileNameSpan);
        listItem.appendChild(removeBtn);
        
        listItem.onclick = () => playSong(index);
        playlistElement.appendChild(listItem);
    });
}

function removeFromPlaylist(index) {
    uploadedFiles.splice(index, 1);
    const mergeBtn = document.getElementById('mergeBtn');
    
    if (uploadedFiles.length < 2) {
        mergeBtn.disabled = true;
    }
    
    updatePlaylist();
    document.getElementById('status').textContent = 'فایل از لیست حذف شد.';
}

function playSong(index) {
    const audioPlayer = document.getElementById('audioPlayer');
    const file = uploadedFiles[index];

    const objectUrl = URL.createObjectURL(file);
    audioPlayer.src = objectUrl;
    audioPlayer.play();

    currentPlayingIndex = index;

    const allItems = document.querySelectorAll('#playlist li');
    allItems.forEach(item => item.classList.remove('playing'));
    allItems[index].classList.add('playing');

    audioPlayer.onended = function() {
        URL.revokeObjectURL(objectUrl);
        playNext();
    };
}

function playNext() {
    if (uploadedFiles.length === 0) return;
    
    const nextIndex = (currentPlayingIndex + 1) % uploadedFiles.length;
    playSong(nextIndex);
}

function shufflePlaylist() {
    for (let i = uploadedFiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uploadedFiles[i], uploadedFiles[j]] = [uploadedFiles[j], uploadedFiles[i]];
    }
    updatePlaylist();
    document.getElementById('status').textContent = 'لیست به صورت تصادفی مرتب شد!';
}

async function mergeAndDownload() {
    const statusText = document.getElementById('status');
    const mergeBtn = document.getElementById('mergeBtn');
    
    statusText.textContent = 'در حال ادغام فایل ها...';
    statusText.style.color = '#666';
    mergeBtn.disabled = true;

    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffers = [];

        for (const file of uploadedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBuffers.push(audioBuffer);
        }

        const totalDuration = audioBuffers.reduce((total, buffer) => total + buffer.duration, 0);
        const outputBuffer = audioContext.createBuffer(
            2,
            Math.ceil(audioContext.sampleRate * totalDuration),
            audioContext.sampleRate
        );

        let offset = 0;
        for (const buffer of audioBuffers) {
            for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                const outputData = outputBuffer.getChannelData(channel);
                const inputData = buffer.getChannelData(channel % buffer.numberOfChannels);
                
                for (let i = 0; i < inputData.length; i++) {
                    outputData[offset + i] = inputData[i];
                }
            }
            offset += buffer.length;
        }

        const wavBlob = audioBufferToWav(outputBuffer);
        mergedAudioBlob = new Blob([wavBlob], { type: 'audio/wav' });

        statusText.textContent = 'در حال ایجاد لینک دائمی...';
        
        // ایجاد لینک دائمی با استفاده از GitHub Gist
        downloadLink = await createPermanentLink(mergedAudioBlob);
        
        document.getElementById('downloadSection').style.display = 'block';
        statusText.textContent = 'ادغام با موفقیت انجام شد! لینک دائمی ایجاد شد.';
        statusText.style.color = '#4CAF50';

        createDownloadLink();

    } catch (error) {
        console.error('Error:', error);
        statusText.textContent = 'خطا در پردازش فایل ها. لطفا دوباره سعی کنید.';
        statusText.style.color = '#ff4757';
    } finally {
        mergeBtn.disabled = false;
    }
}

// تابع برای ایجاد لینک دائمی با GitHub Gist
async function createPermanentLink(blob) {
    // تبدیل blob به base64
    const base64Audio = await blobToBase64(blob);
    
    // ایجاد یک gist با فایل صوتی
    const gistData = {
        description: "ادغام شده آهنگ ها - ایجاد شده توسط وب اپلیکیشن",
        public: true,
        files: {
            "merged-audio.wav": {
                content: base64Audio.split(',')[1] // حذف data:audio/wav;base64,
            }
        }
    };

    const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(gistData)
    });

    if (!response.ok) {
        throw new Error('خطا در ایجاد لینک دائمی');
    }

    const gist = await response.json();
    
    // ایجاد لینک دانلود مستقیم
    return `https://gist.github.com/${gist.owner.login}/${gist.id}/raw/merged-audio.wav`;
}

// تبدیل blob به base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function createDownloadLink() {
    if (!downloadLink) return;

    const downloadSection = document.getElementById('downloadSection');
    downloadSection.innerHTML = '';
    
    const title = document.createElement('h3');
    title.textContent = '✅ لینک دائمی دانلود آماده است!';
    title.style.color = 'white';
    title.style.marginBottom = '1rem';
    
    const linkContainer = document.createElement('div');
    linkContainer.style.margin = '1rem 0';
    linkContainer.style.padding = '1rem';
    linkContainer.style.background = 'rgba(255, 255, 255, 0.2)';
    linkContainer.style.borderRadius = '8px';
    linkContainer.style.wordBreak = 'break-all';
    
    const link = document.createElement('a');
    link.href = downloadLink;
    link.textContent = downloadLink;
    link.target = '_blank';
    link.style.color = '#4ecdc4';
    link.style.textDecoration = 'none';
    link.style.fontWeight = 'bold';
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.marginTop = '1rem';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '1rem';
    buttonContainer.style.flexWrap = 'wrap';
    buttonContainer.style.justifyContent = 'center';
    
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 کپی لینک';
    copyBtn.onclick = () => copyToClipboard(downloadLink);
    copyBtn.style.background = '#4ecdc4';
    
    const directDownloadBtn = document.createElement('button');
    directDownloadBtn.textContent = '⬇️ دانلود مستقیم';
    directDownloadBtn.onclick = () => window.open(downloadLink, '_blank');
    directDownloadBtn.style.background = '#ff6b6b';
    
    const infoText = document.createElement('p');
    infoText.textContent = 'این لینک دائمی است و همیشه فعال خواهد بود ✅';
    infoText.style.marginTop = '1rem';
    infoText.style.fontSize = '0.9em';
    infoText.style.opacity = '0.8';
    infoText.style.color = 'white';
    
    linkContainer.appendChild(link);
    buttonContainer.appendChild(copyBtn);
    buttonContainer.appendChild(directDownloadBtn);
    
    downloadSection.appendChild(title);
    downloadSection.appendChild(linkContainer);
    downloadSection.appendChild(buttonContainer);
    downloadSection.appendChild(infoText);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('لینک با موفقیت کپی شد! ✅');
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('لینک کپی شد!');
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.background = '#4CAF50';
    notification.style.color = 'white';
    notification.style.padding = '1rem 2rem';
    notification.style.borderRadius = '8px';
    notification.style.zIndex = '1000';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        document.body.removeChild(notification);
    }, 3000);
}

function audioBufferToWav(buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels * 2;
    const sampleRate = buffer.sampleRate;
    
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    const writeString = function(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    const offset = 44;
    let pos = offset;

    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numberOfChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
            view.setInt16(pos, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            pos += 2;
        }
    }

    return arrayBuffer;
}

// مقداردهی اولیه
document.getElementById('fileInput').addEventListener('change', function() {
    if (this.files.length > 0) {
        document.getElementById('status').textContent = 'آماده برای اضافه کردن به لیست...';
        document.getElementById('status').style.color = '#666';
    }
});
