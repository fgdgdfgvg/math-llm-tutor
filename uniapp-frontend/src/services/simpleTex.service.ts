import config from '@/config';

interface SimpleTexResponse {
  text: string;
  latex: string;
  confidence: number;
}

class SimpleTexService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = config.apiBaseUrl;
  }

  async recognizeHandwriting(imageData: Blob | File): Promise<SimpleTexResponse> {
    try {
      const formData = new FormData();
      formData.append('image', imageData);

      const token = uni.getStorageSync('token');
      const response = await fetch(`${this.apiBaseUrl}/multimodal/handwriting/recognize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API调用失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('手写识别响应:', data);
      
      return {
        text: data.text || data.latex || '',
        latex: data.latex || '',
        confidence: data.confidence || 0.9
      };
    } catch (error) {
      console.error('手写识别失败:', error);
      throw error;
    }
  }

  async recognizeImage(imageData: Blob | File): Promise<SimpleTexResponse> {
    try {
      const formData = new FormData();
      formData.append('image', imageData);

      const response = await fetch(`${this.apiBaseUrl}/multimodal/image`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API调用失败: ${response.status}`);
      }

      const data = await response.json();
      console.log('图片识别响应:', data);
      
      return {
        text: data.text || data.latex || '',
        latex: data.latex || '',
        confidence: data.confidence || 0.9
      };
    } catch (error) {
      console.error('图片识别失败:', error);
      throw error;
    }
  }

  async checkApiKey(): Promise<boolean> {
    return true;
  }
}

export default new SimpleTexService();
