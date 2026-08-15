// Utility functions
export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export function formatDate(timestamp) {
  if (!timestamp) return '未知時間';
  let date;
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'object' && timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else if (typeof timestamp === 'number' || typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return '未知時間';
  }
  return date.toLocaleString('zh-TW', { 
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).replace(/\//g, '/');
}

export async function uploadImagesToImgBB(iconFile, screenshotFiles) {
  const { IMGBB_API_KEY } = await import('./constants.js');
  
  if (!IMGBB_API_KEY || IMGBB_API_KEY === 'your_imgbb_api_key_here') {
    throw new Error('ImgBB API Key 未設定，請在 constants.js 中配置');
  }

  const uploadToImgBB = async (file) => {
    if (!file) return null;
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error?.message || '圖片上傳失敗');
    return data.data.url;
  };

  const iconUrl = iconFile ? await uploadToImgBB(iconFile) : null;
  
  const screenshotUrls = [];
  if (screenshotFiles && screenshotFiles.length > 0) {
    for (const file of screenshotFiles) {
      if (screenshotUrls.length >= 3) break;
      const url = await uploadToImgBB(file);
      if (url) screenshotUrls.push(url);
    }
  }

  return { iconUrl, screenshotUrls };
}