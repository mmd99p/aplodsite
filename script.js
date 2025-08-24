let uploadedFiles = [];
let currentPlayingIndex = -1;
let mergedAudioBlob = null;

function addToPlaylist() {
    const fileInput = document.getElementById('fileInput');
    const statusText = document.getElementById('status');
    const mergeBtn = document.getElementById('mergeBtn');

    if (fileInput.files.length === 0) {
        statusText.textContent = "لطفا حداقل یک فایل صوتی انتخاب کنید.";
        statusText.style.color = '#ff4757';
        return;
    }

    // اضافه کردن فایل های جدید به لیست
    for (let i = 0; i < fileInput.files.length; i++) {
        const file = fileInput.files[i];
        if (file.type.startsWith('audio/')) {
            uploadedFiles.push(file);
        }
    }

    statusText.textContent = `تعداد ${fileInput.files.length} فایل به لیست اضافه شد!`;
    statusText.style.color = '#4CAF50';

    // فعال کردن دکمه ادغام اگر حداقل دو فایل وجود دارد
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

    // هایلایت کردن آهنگ در حال پخش
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
    statusText.textContent = 'در حال ادغام فایل ها...';
    statusText.style.color = '#666';

    try {
        // ایجاد یک context صوتی
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();

        let currentTime = 0;
        const audioBuffers = [];

        // لود کردن تمام فایل ها به صورت همزمان
        for (const file of uploadedFiles) {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBuffers.push(audioBuffer);
        }

        // ایجاد یک audio buffer برای کل مدت زمان
        const totalDuration = audioBuffers.reduce((total, buffer) => total + buffer.duration, 0);
        const outputBuffer = audioContext.createBuffer(
            2, // stereo
            audioContext.sampleRate * totalDuration,
            audioContext.sampleRate
        );

        // کپی کردن هر audio buffer به مکان مناسب در output buffer
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

        // تبدیل به blob
        const wavBlob = audioBufferToWav(outputBuffer);
        mergedAudioBlob = new Blob([wavBlob], { type: 'audio/wav' });

        // نمایش بخش دانلود
        document.getElementById('downloadSection').style.display = 'block';
        statusText.textContent = 'ادغام با موفقیت انجام شد! حالا می توانید فایل را دانلود کنید.';
        statusText.style.color = '#4CAF50';

    } catch (error) {
        console.error('Error merging files:', error);
        statusText.textContent = 'خطا در ادغام فایل ها. لطفا دوباره尝试 کنید.';
        statusText.style.color = '#ff4757';
    }
}

function audioBufferToWav(buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    const length = buffer.length * numberOfChannels * 2;
    const sampleRate = buffer.sampleRate;
    
    const arrayBuffer = new ArrayBuffer(44 + length);
    const view = new DataView(arrayBuffer);

    // نوشتن header WAV
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

    // نوشتن داده های صوتی
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

function downloadMergedFile() {
    if (!mergedAudioBlob) return;

    const url = URL.createObjectURL(mergedAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ادغام-شده-آهنگها.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
          }
