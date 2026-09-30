<template>
  <!-- 手写输入模态框 -->
  <view v-if="showHandwriting" class="handwriting-modal">
    <view class="modal-mask" @tap="closeModal"></view>
    <view class="modal-content">
      <view class="modal-header">
        <text class="modal-title">手写输入数学公式</text>
        <text class="modal-tip">请书写数学公式，系统将自动识别</text>
        <view class="modal-close" @tap="closeModal">
          <text>✕</text>
        </view>
      </view>
      
      <!-- 手写画布区域 -->
      <view class="canvas-container">
        <canvas 
          id="handwritingCanvas"
          class="handwriting-canvas"
          :style="{
            width: canvasWidth + 'px',
            height: canvasHeight + 'px',
            backgroundColor: '#ffffff'
          }"
          disable-scroll="true"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseLeave"
        ></canvas>
        
        <!-- 操作提示 -->
        <view class="canvas-tips">
          <text>请在白色区域书写数学公式，支持连续书写</text>
        </view>
      </view>
      
      <!-- 工具控制栏 -->
      <view class="control-toolbar">
        <view class="tool-group">
          <button class="tool-btn" @tap="changeBrushSize('small')" :class="{ active: brushSize === 'small' }">
            <text class="tool-icon">●</text>
            <text class="tool-text">细</text>
          </button>
          <button class="tool-btn" @tap="changeBrushSize('medium')" :class="{ active: brushSize === 'medium' }">
            <text class="tool-icon">●</text>
            <text class="tool-text">中</text>
          </button>
          <button class="tool-btn" @tap="changeBrushSize('large')" :class="{ active: brushSize === 'large' }">
            <text class="tool-icon">●</text>
            <text class="tool-text">粗</text>
          </button>
        </view>
        
        <view class="tool-group">
          <button class="tool-btn" @tap="changeColor('#000000')" :class="{ active: currentColor === '#000000' }">
            <text class="tool-icon" style="color: #000000">■</text>
            <text class="tool-text">黑</text>
          </button>
          <button class="tool-btn" @tap="changeColor('#ff3b30')" :class="{ active: currentColor === '#ff3b30' }">
            <text class="tool-icon" style="color: #ff3b30">■</text>
            <text class="tool-text">红</text>
          </button>
          <button class="tool-btn" @tap="changeColor('#007aff')" :class="{ active: currentColor === '#007aff' }">
            <text class="tool-icon" style="color: #007aff">■</text>
            <text class="tool-text">蓝</text>
          </button>
        </view>
      </view>
      
      <!-- 底部操作栏 -->
      <view class="action-toolbar">
        <button class="action-btn undo-btn" @tap="undoAction" :disabled="undoStack.length === 0">
          <text class="action-icon">↶</text>
          <text class="action-text">撤销</text>
        </button>
        
        <button class="action-btn clear-btn" @tap="clearCanvas">
          <text class="action-icon">🗑️</text>
          <text class="action-text">清空</text>
        </button>
        
        <button class="action-btn recognize-btn" @tap="recognizeHandwriting" :disabled="drawingPoints.length === 0">
          <text class="action-icon">✓</text>
          <text class="action-text">识别</text>
        </button>
        
        <button class="action-btn cancel-btn" @tap="closeModal">
          <text class="action-icon">✕</text>
          <text class="action-text">取消</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { request } from '../../utils/request'

// 模态框显示状态
const showHandwriting = ref(false)

// Canvas相关变量
const canvasWidth = ref(300)
const canvasHeight = ref(400)
const devicePixelRatio = ref(1)
const isDrawing = ref(false)
const lastX = ref(0)
const lastY = ref(0)
const canvasContext = ref<CanvasRenderingContext2D | null>(null)

// 画笔设置
const currentColor = ref('#000000')
const brushSize = ref('medium')
const brushSizes = {
  small: 2,
  medium: 4,
  large: 8
}

// 绘制数据
interface DrawingPoint {
  x: number
  y: number
  size: number
  color: string
}
const drawingPoints = ref<DrawingPoint[]>([])
const undoStack = ref<DrawingPoint[][]>([])

// 初始化Canvas
const initCanvas = () => {
  nextTick(() => {
    const query = uni.createSelectorQuery()
    query.select('#handwritingCanvas').fields({
      node: true,
      size: true,
      rect: true
    }).exec((res) => {
      if (res && res[0] && res[0].node) {
        const canvas = res[0].node as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        
        if (ctx) {
          canvasContext.value = ctx
          
          // 获取设备像素比
          devicePixelRatio.value = window.devicePixelRatio || 1
          
          // 设置Canvas物理尺寸
          const width = res[0].width || canvasWidth.value
          const height = res[0].height || canvasHeight.value
          
          canvas.width = width * devicePixelRatio.value
          canvas.height = height * devicePixelRatio.value
          canvas.style.width = `${width}px`
          canvas.style.height = `${height}px`
          
          // 缩放上下文以适配高DPI屏幕
          ctx.scale(devicePixelRatio.value, devicePixelRatio.value)
          
          // 清除画布
          clearCanvas()
          
          console.log('Canvas初始化成功:', { width, height, dpr: devicePixelRatio.value })
        } else {
          console.error('获取Canvas上下文失败')
          uni.showToast({ title: '画布初始化失败', icon: 'error' })
        }
      } else {
        console.error('Canvas元素未找到')
        // 降级处理：创建新的Canvas元素
        createFallbackCanvas()
      }
    })
  })
}

// 降级方案：创建新的Canvas元素
const createFallbackCanvas = () => {
  const container = document.querySelector('.canvas-container')
  if (!container) return
  
  const existingCanvas = document.getElementById('handwritingCanvas')
  if (existingCanvas) existingCanvas.remove()
  
  const canvas = document.createElement('canvas')
  canvas.id = 'handwritingCanvas'
  canvas.className = 'handwriting-canvas'
  canvas.style.width = `${canvasWidth.value}px`
  canvas.style.height = `${canvasHeight.value}px`
  canvas.style.backgroundColor = '#ffffff'
  canvas.style.border = '1px solid #ddd'
  canvas.style.borderRadius = '8px'
  
  container.appendChild(canvas)
  
  // 重新初始化
  setTimeout(() => initCanvas(), 100)
}

// 获取Canvas坐标
const getCanvasCoordinates = (event: any): { x: number; y: number } | null => {
  const canvas = document.getElementById('handwritingCanvas') as HTMLCanvasElement
  if (!canvas) return null
  
  const rect = canvas.getBoundingClientRect()
  
  let clientX = 0
  let clientY = 0
  
  if (event.type.includes('touch')) {
    const touch = event.touches[0] || event.changedTouches[0]
    clientX = touch.clientX
    clientY = touch.clientY
  } else {
    clientX = event.clientX
    clientY = event.clientY
  }
  
  // 计算相对于Canvas的坐标
  const x = (clientX - rect.left) * (canvas.width / devicePixelRatio.value / rect.width)
  const y = (clientY - rect.top) * (canvas.height / devicePixelRatio.value / rect.height)
  
  return { x, y }
}

// 触摸/鼠标事件处理
const onTouchStart = (event: TouchEvent) => {
  event.preventDefault()
  startDrawing(event)
}

const onTouchMove = (event: TouchEvent) => {
  event.preventDefault()
  moveDrawing(event)
}

const onTouchEnd = (event: TouchEvent) => {
  event.preventDefault()
  stopDrawing(event)
}

const onMouseDown = (event: MouseEvent) => {
  startDrawing(event)
}

const onMouseMove = (event: MouseEvent) => {
  moveDrawing(event)
}

const onMouseUp = (event: MouseEvent) => {
  stopDrawing(event)
}

const onMouseLeave = (event: MouseEvent) => {
  if (isDrawing.value) {
    stopDrawing(event)
  }
}

// 开始绘制
const startDrawing = (event: any) => {
  const coords = getCanvasCoordinates(event)
  if (!coords || !canvasContext.value) return
  
  isDrawing.value = true
  lastX.value = coords.x
  lastY.value = coords.y
  
  // 保存当前状态到撤销栈
  if (drawingPoints.value.length === 0) {
    undoStack.value.push([])
  }
  
  drawPoint(coords.x, coords.y)
}

// 移动绘制
const moveDrawing = (event: any) => {
  if (!isDrawing.value || !canvasContext.value) return
  
  const coords = getCanvasCoordinates(event)
  if (!coords) return
  
  drawLine(lastX.value, lastY.value, coords.x, coords.y)
  
  // 保存绘制点
  drawingPoints.value.push({
    x: coords.x,
    y: coords.y,
    size: brushSizes[brushSize.value],
    color: currentColor.value
  })
  
  lastX.value = coords.x
  lastY.value = coords.y
}

// 停止绘制
const stopDrawing = (event: any) => {
  if (!isDrawing.value) return
  
  isDrawing.value = false
  
  // 如果本次有绘制，保存到撤销栈
  if (drawingPoints.value.length > 0) {
    undoStack.value.push([...drawingPoints.value])
    drawingPoints.value = []
  }
}

// 绘制点
const drawPoint = (x: number, y: number) => {
  if (!canvasContext.value) return
  
  const ctx = canvasContext.value
  const size = brushSizes[brushSize.value]
  
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = currentColor.value
  ctx.fill()
  
  // 保存绘制点
  drawingPoints.value.push({
    x,
    y,
    size,
    color: currentColor.value
  })
}

// 绘制线条
const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
  if (!canvasContext.value) return
  
  const ctx = canvasContext.value
  const size = brushSizes[brushSize.value]
  
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.strokeStyle = currentColor.value
  ctx.lineWidth = size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

// 清空画布
const clearCanvas = () => {
  if (!canvasContext.value) return
  
  const ctx = canvasContext.value
  ctx.clearRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 重置背景色
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth.value, canvasHeight.value)
  
  // 清空绘制数据
  drawingPoints.value = []
  undoStack.value = []
  
  console.log('画布已清空')
}

// 撤销上一步
const undoAction = () => {
  if (undoStack.value.length === 0 || !canvasContext.value) return
  
  // 移除最后一步
  undoStack.value.pop()
  
  // 清空画布
  clearCanvas()
  
  // 重新绘制所有步骤
  const ctx = canvasContext.value
  undoStack.value.forEach((step) => {
    if (step.length === 0) return
    
    // 绘制步骤中的点
    for (let i = 0; i < step.length; i++) {
      const point = step[i]
      ctx.beginPath()
      ctx.arc(point.x, point.y, point.size / 2, 0, Math.PI * 2)
      ctx.fillStyle = point.color
      ctx.fill()
      
      // 连接点之间的线
      if (i > 0) {
        const prevPoint = step[i - 1]
        ctx.beginPath()
        ctx.moveTo(prevPoint.x, prevPoint.y)
        ctx.lineTo(point.x, point.y)
        ctx.strokeStyle = point.color
        ctx.lineWidth = point.size
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
    }
  })
}

// 改变画笔大小
const changeBrushSize = (size: 'small' | 'medium' | 'large') => {
  brushSize.value = size
  uni.showToast({
    title: `画笔大小: ${size === 'small' ? '细' : size === 'medium' ? '中' : '粗'}`,
    icon: 'none',
    duration: 1000
  })
}

// 改变画笔颜色
const changeColor = (color: string) => {
  currentColor.value = color
  uni.showToast({
    title: `画笔颜色已切换`,
    icon: 'none',
    duration: 1000
  })
}

// 识别手写内容
const recognizeHandwriting = async () => {
  if (!canvasContext.value) {
    uni.showToast({ title: '画布未初始化', icon: 'error' })
    return
  }
  
  try {
    // 获取Canvas图片数据
    const canvas = document.getElementById('handwritingCanvas') as HTMLCanvasElement
    if (!canvas) {
      uni.showToast({ title: '画布元素不存在', icon: 'error' })
      return
    }
    
    // 显示加载状态
    uni.showLoading({ title: '识别中...', mask: true })
    
    // 转换为Base64格式
    const imageData = canvas.toDataURL('image/png', 1.0)
    
    // 发送到后端进行识别
    const response = await request({
      url: '/api/ocr/handwriting',
      method: 'POST',
      data: {
        image: imageData.split(',')[1], // 移除Base64前缀
        type: 'formula'
      },
      timeout: 30000
    })
    
    uni.hideLoading()
    
    if (response && response.success && response.data && response.data.text) {
      const recognizedText = response.data.text
      
      // 触发识别成功事件
      emit('recognized', recognizedText)
      
      uni.showToast({
        title: '识别成功',
        icon: 'success',
        duration: 2000
      })
      
      // 自动关闭模态框（可选）
      closeModal()
    } else {
      uni.showToast({
        title: response?.message || '识别失败，请重试',
        icon: 'error'
      })
    }
  } catch (error: any) {
    uni.hideLoading()
    console.error('手写识别错误:', error)
    
    // 模拟识别结果（测试用）
    if (process.env.NODE_ENV === 'development') {
      const mockText = 'f(x) = \\frac{x^2 + 1}{x - 3}'
      emit('recognized', mockText)
      uni.showToast({
        title: '测试模式：使用模拟数据',
        icon: 'none',
        duration: 2000
      })
      closeModal()
    } else {
      uni.showToast({
        title: '识别服务异常，请稍后重试',
        icon: 'error'
      })
    }
  }
}

// 关闭模态框
const closeModal = () => {
  showHandwriting.value = false
  emit('close')
}

// 打开模态框
const openModal = () => {
  showHandwriting.value = true
  nextTick(() => {
    setTimeout(() => {
      initCanvas()
    }, 100)
  })
}

// 定义事件
const emit = defineEmits<{
  (event: 'recognized', text: string): void
  (event: 'close'): void
}>()

// 暴露方法给父组件
defineExpose({
  openModal,
  closeModal,
  clearCanvas,
  recognizeHandwriting
})

// 生命周期
onMounted(() => {
  // 监听窗口大小变化
  window.addEventListener('resize', initCanvas)
})

onUnmounted(() => {
  window.removeEventListener('resize', initCanvas)
})
</script>

<style scoped>
.handwriting-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1001;
}

.modal-content {
  position: relative;
  width: 90%;
  max-width: 800px;
  max-height: 90vh;
  background-color: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  z-index: 1002;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  position: relative;
}

.modal-title {
  font-size: 20px;
  font-weight: 600;
  display: block;
  margin-bottom: 8px;
}

.modal-tip {
  font-size: 14px;
  opacity: 0.9;
  display: block;
}

.modal-close {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.modal-close:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.canvas-container {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
}

.handwriting-canvas {
  width: 100%;
  max-width: 100%;
  height: 400px;
  border: 2px dashed #ddd;
  border-radius: 12px;
  background-color: #ffffff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.handwriting-canvas:active {
  cursor: crosshair;
}

.canvas-tips {
  margin-top: 12px;
  font-size: 14px;
  color: #666;
  text-align: center;
}

.control-toolbar {
  padding: 16px 24px;
  background-color: #f5f5f7;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tool-group {
  display: flex;
  gap: 12px;
}

.tool-btn {
  padding: 8px 16px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  cursor: pointer;
}

.tool-btn.active {
  background-color: #667eea;
  color: white;
  border-color: #667eea;
}

.tool-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.tool-icon {
  font-size: 16px;
  line-height: 1;
}

.tool-text {
  font-weight: 500;
}

.action-toolbar {
  padding: 20px 24px;
  background-color: white;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.undo-btn {
  background-color: #f8f9fa;
  color: #666;
}

.undo-btn:not(:disabled):hover {
  background-color: #e9ecef;
  transform: translateY(-2px);
}

.clear-btn {
  background-color: #fff3cd;
  color: #856404;
}

.clear-btn:not(:disabled):hover {
  background-color: #ffeaa7;
  transform: translateY(-2px);
}

.recognize-btn {
  background-color: #28a745;
  color: white;
}

.recognize-btn:not(:disabled):hover {
  background-color: #218838;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

.cancel-btn {
  background-color: #dc3545;
  color: white;
}

.cancel-btn:hover {
  background-color: #c82333;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
}

.action-icon {
  font-size: 18px;
  line-height: 1;
}

.action-text {
  font-weight: 600;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .modal-content {
    width: 95%;
    max-height: 85vh;
  }
  
  .handwriting-canvas {
    height: 300px;
  }
  
  .control-toolbar {
    flex-direction: column;
    gap: 12px;
  }
  
  .tool-group {
    width: 100%;
    justify-content: space-between;
  }
  
  .action-toolbar {
    flex-wrap: wrap;
  }
  
  .action-btn {
    min-width: calc(50% - 6px);
  }
}

/* 动画效果 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-content {
  animation: fadeIn 0.3s ease-out;
}

/* 防止滚动穿透 */
.handwriting-modal {
  overflow: hidden;
}
</style>
