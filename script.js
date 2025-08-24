let uploadedFiles = [];
let currentPlayingIndex = -1;
let mergedAudioBlob = null;
let downloadLink = '';

// [کدهای قبلی بدون تغییر تا تابع mergeAndDownload()]

async function mergeAndDownload() {
    const statusText = document.getElementById('status');
    statusText.textContent = 'در حال ادغام فایل ها...';
    statusText.style.color = '#666';

    try {
        // ایجاد یک context صوتی
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
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

        // آپلود فایل روی Pixeldrain و دریافت لینک دانلود
        statusText.textContent = 'در حال آپلود فایل برای ایجاد لینک دانلود...';
        
        downloadLink = await uploadToPixeldrain(mergedAudioBlob);
        
        // نمایش بخش دانلود با لینک
        document.getElementById('downloadSection').style.display = 'block';
        statusText.textContent = 'ادغام و آپلود با موفقیت انجام شد!';
        statusText.style.color = '#4CAF50';

    } catch (error) {
        console.error('Error:', error);
        statusText.textContent = 'خطا در پردازش فایل ها. لطفا دوباره尝试 کنید.';
        statusText.style.color = '#ff4757';
    }
}

// تابع برای آپلود به Pixeldrain
async function uploadToPixeldrain(blob) {
    const formData = new FormData();
    formData.append('file', blob, 'ادغام-شده-آهنگها.wav');
    
    const response = await fetch('https://pixeldrain.com/api/file', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('آپلود失敗 شد');
    }
    
    const data = await response.json();
    return `https://pixeldrain.com/api/file/${data.id}/download`;
}

// تابع برای ایجاد لینک دانلود قابل کپی
function downloadMergedFile() {
    if (!downloadLink) return;

    // ایجاد یک div برای نمایش لینک
    const downloadSection = document.getElementById('downloadSection');
    
    // پاک کردن محتوای قبلی
    downloadSection.innerHTML = '';
    
    // ایجاد عناصر جدید
    const title = document.createElement('h3');
    title.textContent = '✅ لینک دانلود آماده است!';
    title.style.color = 'white';
    
    const linkContainer = document.createElement('div');
    linkContainer.style.margin = '1rem 0';
    linkContainer.style.padding = '1rem';
    linkContainer.style.background = 'rgba(255, 255, 255, 0.2)';
    linkContainer.style.borderRadius = '8px';
    
    const link = document.createElement('a');
    link.href = downloadLink;
    link.textContent = 'لینک دانلود فایل ادغام شده';
    link.target = '_blank';
    link.style.color = '#4ecdc4';
    link.style.textDecoration = 'none';
    link.style.fontWeight = 'bold';
    
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 کپی لینک';
    copyBtn.onclick = () => copyToClipboard(downloadLink);
    copyBtn.style.marginRight = '1rem';
    copyBtn.style.background = '#4ecdc4';
    
    const directDownloadBtn = document.createElement('button');
    directDownloadBtn.textContent = '⬇️ دانلود مستقیم';
    directDownloadBtn.onclick = () => window.open(downloadLink, '_blank');
    directDownloadBtn.style.background = '#ff6b6b';
    
    // اضافه کردن عناصر به صفحه
    linkContainer.appendChild(link);
    downloadSection.appendChild(title);
    downloadSection.appendChild(linkContainer);
    downloadSection.appendChild(copyBtn);
    downloadSection.appendChild(directDownloadBtn);
    
    // اضافه کردن اطلاعات اضافی
    const infoText = document.createElement('p');
    infoText.textContent = 'این لینک به مدت 30 روز فعال خواهد بود';
    infoText.style.marginTop = '1rem';
    infoText.style.fontSize = '0.9em';
    infoText.style.opacity = '0.8';
    downloadSection.appendChild(infoText);
}

// تابع برای کپی کردن لینک به کلیپ‌بورد
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert('لینک با موفقیت کپی شد! ✅');
    } catch (err) {
        // Fallback برای مرورگرهای قدیمی
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('لینک کپی شد!');
    }
}

// [بقیه توابع بدون تغییر بمانند...]
