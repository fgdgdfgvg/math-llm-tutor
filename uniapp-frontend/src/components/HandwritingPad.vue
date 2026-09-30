<template>
  <view class="handwriting-modal" v-if="visible">
    <view class="modal-content">
      <view class="modal-header">
        <text class="modal-title">手写输入</text>
        <button class="close-btn" @click.stop="close">✕</button>
      </view>
      <view class="user-guide">
        <text class="guide-text">💡 操作提示：选择画笔粗细和颜色，在画布上书写，支持撤销和清空操作</text>
      </view>
      <view class="canvas-container">
        <canvas 
          id="handwritingCanvas"
          class="handwriting-canvas" 
          :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
          @touchstart="startDrawing"
          @touchmove.prevent="draw"
          @touchend="stopDrawing"
          @mousedown="startDrawing"
          @mousemove="draw"
          @mouseup="stopDrawing"
          @mouseleave="stopDrawing"
        />
      </view>
      <view class="canvas-toolbar">
        <view class="tool-section">
          <text class="tool-label">画笔粗细</text>
          <view class="brush-size-options">
            <button 
              class="size-btn" 
              :class="{ 'active': brushSize === 1 }"
              @click="setBrushSize(1)"
            >细</button>
            <button 
              class="size-btn" 
              :class="{ 'active': brushSize === 3 }"
              @click="setBrushSize(3)"
            >中</button>
            <button 
              class="size-btn" 
              :class="{ 'active': brushSize === 5 }"
              @click="setBrushSize(5)"
            >粗</button>
          </view>
        </view>
        <view class="tool-section">
          <text class="tool-label">颜色</text>
          <view class="color-options">
            <button 
              v-for="color in colors" 
              :key="color"
              class="color-btn"
              :style="{ backgroundColor: color }"
              :class="{ 'active': brushColor === color }"
              @click="setBrushColor(color)"
              :title="getColorName(color)"
            ></button>
            <button 
              class="color-btn custom-color-btn"
              :style="{ backgroundColor: customColor }"
              @click="toggleColorPicker"
              title="自定义颜色"
            >+</button>
          </view>
          <!-- 自定义颜色选择器 -->
          <view class="custom-color-picker" v-if="showColorPicker">
            <input 
              type="color" 
              v-model="customColor" 
              @change="setCustomColor"
              class="color-input"
            />
            <button class="confirm-color-btn" @click="confirmCustomColor">确定</button>
            <button class="cancel-color-btn" @click="showColorPicker = false">取消</button>
          </view>
        </view>
      </view>
      <view class="canvas-controls">
        <button class="control-btn" @click="undo" title="撤销上一步操作">撤销</button>
        <button class="control-btn" @click="redo" title="重做上一步操作">重做</button>
        <button class="control-btn" @click="clearCanvas" title="清空画布">清空</button>
        <button class="control-btn" @click="recognizeHandwriting" title="识别手写内容">识别</button>
        <button class="control-btn" @click.stop="close" title="关闭手写板">取消</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import simpleTexService from '../services/simpleTex.service';

interface Props {
  visible: boolean;
}

interface Emits {
  (e: 'update:visible', value: boolean): void;
  (e: 'recognized', text: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Canvas 相关状态
const canvas = ref<any>(null);
const canvasWidth = ref(300);
const canvasHeight = ref(200);
const devicePixelRatio = ref(uni.getSystemInfoSync().pixelRatio || 1);

// Canvas初始化重试计数
let canvasInitRetryCount = 0;

// 画笔相关
const brushSize = ref(3); // 默认中等粗细
const brushColor = ref('#000000'); // 默认黑色

// 简化颜色系统，仅保留4种核心颜色
const colors = ref([
  '#000000', // 黑色
  '#ff0000', // 红色
  '#0000ff', // 蓝色
  '#008000'  // 绿色
]);

const showColorPicker = ref(false); // 自定义颜色选择器显示状态
const customColor = ref('#000000'); // 自定义颜色

// 基准点位置偏移量（像素）
const cursorOffsetX = ref(15); // 水平偏移
const cursorOffsetY = ref(15); // 垂直偏移

// 笔画数据结构
interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  size: number;
}

// 撤销/重做堆栈
const undoStack = ref<Stroke[]>([]);
const redoStack = ref<Stroke[]>([]);
const maxStackSize = 50; // 最大堆栈大小

let currentStroke: Stroke | null = null; // 当前正在绘制的笔画
let ctx: CanvasRenderingContext2D | null = null; // 全局上下文引用

// 事件防抖处理
let lastDrawTime = 0;
const debounceThreshold = 16; // 约60fps

// 生命周期
onMounted(() => {
  if (props.visible) {
    initCanvasSize();
  }
  
  // 从本地存储加载颜色设置
  try {
    const savedColor = uni.getStorageSync('handwriting_brush_color');
    if (savedColor) {
      brushColor.value = savedColor;
    }
  } catch (error) {
    console.error('加载颜色设置失败:', error);
  }
  
  // 监听窗口尺寸变化
  uni.onWindowResize(() => {
    if (props.visible) {
      initCanvasSize();
    }
  });
});

// 监听可见性变化
watch(() => props.visible, (newVisible) => {
  if (newVisible) {
    nextTick(() => {
      initCanvasSize();
    });
  }
});

// 初始化Canvas尺寸
const initCanvasSize = () => {
  nextTick(() => {
    setTimeout(() => {
      let canvasElement: HTMLCanvasElement | null = null;
      
      const element = document.getElementById('handwritingCanvas');
      console.log('获取到的元素:', element, 'tagName:', element?.tagName);
      
      if (element && element.tagName === 'CANVAS') {
        canvasElement = element as HTMLCanvasElement;
      } else if (element) {
        const innerCanvas = element.querySelector('canvas');
        if (innerCanvas) {
          canvasElement = innerCanvas as HTMLCanvasElement;
          console.log('找到内部 canvas:', innerCanvas);
        }
      }
      
      if (!canvasElement) {
        const queryCanvas = document.querySelector('#handwritingCanvas canvas') as HTMLCanvasElement;
        if (queryCanvas) {
          canvasElement = queryCanvas;
        }
      }
      
      if (!canvasElement) {
        console.error('Canvas 元素未找到');
        if (canvasInitRetryCount < 5) {
          canvasInitRetryCount++;
          console.log(`Canvas元素未找到，第${canvasInitRetryCount}次重试中...`);
          setTimeout(() => initCanvasSize(), 300);
        }
        return;
      }
      
      console.log('找到 Canvas 元素:', canvasElement.tagName);
      initializeCanvas(canvasElement);
    }, 150);
  });
};

// 初始化Canvas的核心函数
const initializeCanvas = (canvasElement: HTMLCanvasElement) => {
  try {
    if (typeof canvasElement.getContext !== 'function') {
      console.error('元素不支持 getContext:', typeof canvasElement.getContext);
      return;
    }
    
    const container = document.querySelector('.canvas-container');
    if (!container) {
      console.error('Canvas容器未找到');
      return;
    }
    
    const containerWidth = Math.max(100, Math.floor(container.clientWidth - 40));
    const containerHeight = 200;
    
    canvasWidth.value = containerWidth;
    canvasHeight.value = containerHeight;
    
    // 处理设备像素比
    const dpr = devicePixelRatio.value;
    canvasElement.width = containerWidth * dpr;
    canvasElement.height = containerHeight * dpr;
    canvasElement.style.width = containerWidth + 'px';
    canvasElement.style.height = containerHeight + 'px';
    canvasElement.style.boxSizing = 'border-box';
    
    console.log('Canvas 尺寸设置:', containerWidth, 'x', containerHeight);
    console.log('Canvas 实际尺寸 (考虑DPR):', canvasElement.width, 'x', canvasElement.height);
    console.log('Canvas CSS尺寸:', canvasElement.style.width, 'x', canvasElement.style.height);
    console.log('Device Pixel Ratio:', dpr);
    
    ctx = canvasElement.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
    if (ctx) {
      // 缩放上下文以匹配设备像素比
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = brushSize.value;
      ctx.strokeStyle = brushColor.value;
      
      canvasInitRetryCount = 0;
      console.log('Canvas初始化成功 - 坐标系统已校准');
    } else {
      console.error('无法获取Canvas上下文');
    }
  } catch (error) {
    console.error('初始化Canvas失败:', error);
  }
};

// 关闭模态框
const close = () => {
  emit('update:visible', false);
};

// Canvas初始化失败的降级处理
const handleCanvasInitFailure = () => {
  try {
    uni.showToast({ title: '手写板初始化失败，正在尝试修复...', icon: 'none' });
    ctx = null;
    // 增加重试计数，若已重试多次则提示用户
    if (canvasInitRetryCount < 3) {
      canvasInitRetryCount++;
      setTimeout(() => {
        initCanvasSize();
      }, 1000);
    } else {
      uni.showToast({ title: '手写板初始化失败，请刷新页面重试', icon: 'none' });
    }
  } catch (error) {
    console.error('Canvas降级处理失败:', error);
    uni.showToast({ title: '手写板初始化失败，请刷新页面重试', icon: 'none' });
  }
};

// 画笔设置方法
const setBrushSize = (size: number) => {
  brushSize.value = size;
  if (ctx) {
    ctx.lineWidth = size;
  }
};

const setBrushColor = (color: string) => {
  brushColor.value = color;
  if (ctx) {
    ctx.strokeStyle = color;
  }
  // 保存颜色选择到本地存储
  try {
    uni.setStorageSync('handwriting_brush_color', color);
  } catch (error) {
    console.error('保存颜色设置失败:', error);
  }
};

// 自定义颜色选择相关方法
const toggleColorPicker = () => {
  showColorPicker.value = !showColorPicker.value;
};

const setCustomColor = (e: any) => {
  customColor.value = e.target.value;
};

const confirmCustomColor = () => {
  setBrushColor(customColor.value);
  showColorPicker.value = false;
  uni.showToast({ title: '颜色已更新', icon: 'success' });
};

// 获取颜色名称
const getColorName = (color: string): string => {
  const colorNames: Record<string, string> = {
    '#000000': '黑色',
    '#ff0000': '红色',
    '#0000ff': '蓝色',
    '#008000': '绿色'
  };
  return colorNames[color] || color;
};

// 重绘所有笔画
const redrawAllStrokes = () => {
  if (!ctx) return;
  
  const w = Math.max(1, Math.floor(canvasWidth.value));
  const h = Math.max(1, Math.floor(canvasHeight.value));
  ctx.clearRect(0, 0, w, h);
  
  // 重新绘制所有笔画
  for (const stroke of undoStack.value) {
    drawBezierCurve(stroke.points, stroke.color, stroke.size);
  }
};

// 撤销功能
const undo = () => {
  if (undoStack.value.length > 0 && ctx) {
    // 将笔画移到重做堆栈
    const lastStroke = undoStack.value.pop();
    if (lastStroke) {
      redoStack.value.push(lastStroke);
      
      // 限制重做堆栈大小
      if (redoStack.value.length > maxStackSize) {
        redoStack.value.shift();
      }
      
      // 重绘所有笔画
      redrawAllStrokes();
      uni.showToast({ title: '已撤销', icon: 'success' });
    }
  } else {
    uni.showToast({ title: '没有可撤销的操作', icon: 'none' });
  }
};

// 重做功能
const redo = () => {
  if (redoStack.value.length > 0 && ctx) {
    // 将笔画移回撤销堆栈
    const lastStroke = redoStack.value.pop();
    if (lastStroke) {
      undoStack.value.push(lastStroke);
      
      // 限制撤销堆栈大小
      if (undoStack.value.length > maxStackSize) {
        undoStack.value.shift();
      }
      
      // 重绘所有笔画以确保状态一致性
      redrawAllStrokes();
      uni.showToast({ title: '已重做', icon: 'success' });
    }
  } else {
    uni.showToast({ title: '没有可重做的操作', icon: 'none' });
  }
};

// 清空画布
const clearCanvas = () => {
  if (!ctx) return;
  
  const w = Math.max(1, Math.floor(canvasWidth.value));
  const h = Math.max(1, Math.floor(canvasHeight.value));
  ctx.clearRect(0, 0, w, h);
  
  // 清空撤销和重做堆栈
  undoStack.value = [];
  redoStack.value = [];
  currentStroke = null;
  
  uni.showToast({ title: '画布已清空', icon: 'success' });
};

// 检查画布是否为空
const checkCanvasEmpty = (): boolean => {
  if (!ctx) return true;
  try {
    const w = Math.max(1, Math.floor(canvasWidth.value));
    const h = Math.max(1, Math.floor(canvasHeight.value));
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) return false;
    }
    return true;
  } catch (error) {
    console.error('检查画布失败:', error);
    return true;
  }
};

// 识别手写内容
const recognizeHandwriting = async () => {
  try {
    if (!ctx) {
      uni.showToast({ title: '手写板初始化失败', icon: 'none' });
      return;
    }
    
    const isCanvasEmpty = checkCanvasEmpty();
    if (isCanvasEmpty) {
      uni.showToast({ title: '未检测到手写输入', icon: 'none' });
      return;
    }
    
    uni.showLoading({ title: '识别中...' });
    
    const canvasElement = getRealCanvas();
    if (!canvasElement) {
      uni.hideLoading();
      uni.showToast({ title: '获取画布失败', icon: 'none' });
      return;
    }
    
    canvasElement.toBlob(async (blob) => {
      if (blob) {
        try {
          const result = await simpleTexService.recognizeHandwriting(blob);
          
          if (result.text) {
            emit('recognized', result.text);
            close();
            uni.hideLoading();
            uni.showToast({ title: '识别成功', icon: 'success' });
          } else {
            uni.hideLoading();
            uni.showToast({ title: '识别失败，未返回有效结果', icon: 'none' });
          }
        } catch (error) {
          console.error('手写识别失败:', error);
          uni.hideLoading();
          uni.showToast({ title: '识别失败，请重试', icon: 'none' });
        }
      } else {
        uni.hideLoading();
        uni.showToast({ title: '获取手写数据失败', icon: 'none' });
      }
    });
  } catch (error) {
    console.error('获取Canvas数据失败:', error);
    uni.hideLoading();
    uni.showToast({ title: '获取手写数据失败', icon: 'none' });
  }
};

// 获取真正的 Canvas 元素
const getRealCanvas = (): HTMLCanvasElement | null => {
  const element = document.getElementById('handwritingCanvas');
  if (element && element.tagName === 'CANVAS') {
    return element as HTMLCanvasElement;
  }
  if (element) {
    const innerCanvas = element.querySelector('canvas');
    if (innerCanvas) return innerCanvas as HTMLCanvasElement;
  }
  return document.querySelector('#handwritingCanvas canvas') as HTMLCanvasElement;
};

// 坐标转换工具函数 - 修复坐标偏移问题
const getCanvasCoordinates = (event: any) => {
  return new Promise<{ x: number; y: number }>((resolve) => {
    try {
      const canvasElement = getRealCanvas();
      if (!canvasElement) {
        resolve({ x: 0, y: 0 });
        return;
      }
      
      const rect = canvasElement.getBoundingClientRect();
      
      const clientX = event.touches ? event.touches[0].clientX : event.clientX;
      const clientY = event.touches ? event.touches[0].clientY : event.clientY;
      
      // 应用基准点偏移量
      const adjustedX = clientX - cursorOffsetX.value;
      const adjustedY = clientY - cursorOffsetY.value;
      
      const cssX = adjustedX - rect.left;
      const cssY = adjustedY - rect.top;
      
      // 由于我们已经通过 ctx.scale(dpr, dpr) 处理了设备像素比，
      // 这里直接使用CSS坐标即可，因为上下文已经缩放过了
      const canvasX = cssX;
      const canvasY = cssY;
      
      console.log('Canvas坐标计算:', {
        clientX, clientY,
        adjustedX, adjustedY,
        rectLeft: rect.left, rectTop: rect.top,
        cssX, cssY,
        canvasX, canvasY,
        offsetX: cursorOffsetX.value, offsetY: cursorOffsetY.value
      });
      
      resolve({ x: canvasX, y: canvasY });
    } catch (error) {
      console.error('获取坐标失败:', error);
      resolve({ x: 0, y: 0 });
    }
  });
};

// 手写输入相关方法
const startDrawing = async (e: any) => {
  if (!ctx) return;
  
  const coords = await getCanvasCoordinates(e);
  
  // 创建新的笔画
  currentStroke = {
    points: [coords],
    color: brushColor.value,
    size: brushSize.value
  };
  
  // 清空重做堆栈
  redoStack.value = [];
};

// 绘制贝塞尔曲线
const drawBezierCurve = (points: { x: number; y: number }[], color: string, size: number) => {
  if (!ctx || points.length < 2) return;
  
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.stroke();
};

const draw = async (e: any) => {
  if (!currentStroke || !ctx) return;
  
  const currentTime = Date.now();
  if (currentTime - lastDrawTime < debounceThreshold) {
    return;
  }
  lastDrawTime = currentTime;
  
  const coords = await getCanvasCoordinates(e);
  
  // 添加点到当前笔画
  currentStroke.points.push(coords);
  
  // 绘制贝塞尔曲线
  drawBezierCurve(currentStroke.points, currentStroke.color, currentStroke.size);
};

const stopDrawing = () => {
  if (currentStroke) {
    // 确保笔画有足够的点
    if (currentStroke.points.length > 1) {
      // 添加到撤销堆栈
      undoStack.value.push(currentStroke);
      
      // 限制堆栈大小
      if (undoStack.value.length > maxStackSize) {
        undoStack.value.shift();
      }
    }
    
    currentStroke = null;
  }
};
</script>

<style scoped>
.handwriting-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
}

.user-guide {
  padding: 10px 15px;
  background: #e3f2fd;
  border-bottom: 1px solid #bbdefb;
  animation: slideIn 0.3s ease;
}

.guide-text {
  font-size: 12px;
  color: #1976d2;
  line-height: 1.4;
}

@keyframes slideIn {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  padding: 0;
  width: 30px;
  height: 30px;
  line-height: 30px;
  text-align: center;
}

.canvas-container {
  padding: 20px;
  background: #fafafa;
  display: flex;
  justify-content: center;
  align-items: center;
}

.handwriting-canvas {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box;
  display: block;
}

.canvas-toolbar {
  padding: 15px;
  background: #f8f9fa;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
}

.tool-section {
  margin-bottom: 10px;
}

.tool-section:last-child {
  margin-bottom: 0;
}

.tool-label {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  display: block;
}

.brush-size-options {
  display: flex;
  gap: 10px;
}

.size-btn {
  flex: 1;
  background: white;
  border: 1px solid #ddd;
  border-radius: 15px;
  height: 30px;
  line-height: 30px;
  font-size: 12px;
  color: #333;
  transition: all 0.3s ease;
}

.size-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: #667eea;
  color: white;
}

.color-options {
  display: flex;
  gap: 8px;
}

.color-btn {
  width: 30px;
  height: 30px;
  border: 2px solid #ddd;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.color-btn.active {
  border-color: #667eea;
  transform: scale(1.1);
}

.custom-color-btn {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-color-picker {
  margin-top: 10px;
  padding: 10px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: fadeIn 0.3s ease;
}

.color-input {
  width: 100%;
  height: 40px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-color-btn, .cancel-color-btn {
  flex: 1;
  height: 35px;
  border: none;
  border-radius: 15px;
  font-size: 14px;
  transition: all 0.3s ease;
}

.confirm-color-btn {
  background: #4caf50;
  color: white;
}

.cancel-color-btn {
  background: #f44336;
  color: white;
}

.confirm-color-btn:hover, .cancel-color-btn:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

.canvas-controls {
  display: flex;
  gap: 10px;
  padding: 15px;
  background: #f8f9fa;
  border-top: 1px solid #eee;
}

.control-btn {
  flex: 1;
  background: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  height: 35px;
  line-height: 35px;
  font-size: 14px;
  color: #333;
  transition: all 0.3s ease;
}

.control-btn:first-child {
  background: #ffebee;
  border-color: #f44336;
  color: #f44336;
}

.control-btn:nth-child(2) {
  background: #e3f2fd;
  border-color: #1976d2;
  color: #1976d2;
}

.control-btn:nth-child(3) {
  background: #e8f5e9;
  border-color: #4caf50;
  color: #4caf50;
}

.control-btn:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>