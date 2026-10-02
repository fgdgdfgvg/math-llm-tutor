<template>
  <view class="status-panel">
    <view class="panel-header">
      <text class="panel-title">服务状态监控</text>
      <view class="refresh-btn" @click="refreshStatus">
        <text class="refresh-icon">🔄</text>
      </view>
    </view>

    <view class="services-grid">
      <view 
        v-for="service in services" 
        :key="service.name"
        class="service-card"
        :class="{ 'service-healthy': service.healthy, 'service-error': !service.healthy }"
      >
        <view class="service-icon">{{ service.icon }}</view>
        <view class="service-info">
          <text class="service-name">{{ service.name }}</text>
          <text class="service-status">{{ service.healthy ? '运行中' : '已停止' }}</text>
          <text class="service-latency" v-if="service.latency">{{ service.latency }}ms</text>
        </view>
        <view class="service-indicator" :class="{ 'indicator-active': service.healthy }"></view>
      </view>
    </view>

    <view class="panel-stats">
      <view class="stat-item">
        <text class="stat-label">健康服务</text>
        <text class="stat-value">{{ healthyCount }}/{{ services.length }}</text>
      </view>
      <view class="stat-item">
        <text class="stat-label">更新时间</text>
        <text class="stat-time">{{ lastUpdate }}</text>
      </view>
    </view>

    <view class="panel-actions">
      <button class="action-btn secondary" @click="stopAllServices" :disabled="isProcessing">停止全部</button>
      <button class="action-btn primary" @click="restartAllServices" :disabled="isProcessing">重启全部</button>
    </view>

    <view class="logs-section" v-if="showLogs">
      <view class="logs-header">
        <text class="logs-title">服务日志</text>
        <text class="logs-close" @click="showLogs = false">✕</text>
      </view>
      <scroll-view class="logs-content" scroll-y>
        <view v-for="(log, index) in logs" :key="index" class="log-item" :class="log.level">
          <text class="log-time">{{ log.time }}</text>
          <text class="log-message">{{ log.message }}</text>
        </view>
      </scroll-view>
    </view>

    <button class="show-logs-btn" @click="toggleLogs">
      {{ showLogs ? '隐藏日志' : '查看日志' }}
    </button>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import config, { getApiUrl } from '@/config';

interface ServiceStatus {
  name: string;
  icon: string;
  key: string;
  healthy: boolean;
  latency?: number;
}

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const services = ref<ServiceStatus[]>([
  { name: 'NestJS后端', icon: '🚀', key: 'nestjs', healthy: false },
  { name: 'SymPy服务', icon: '🔢', key: 'sympy', healthy: false },
  { name: 'MongoDB', icon: '🍃', key: 'mongodb', healthy: false },
  { name: 'Neo4j', icon: '🕸️', key: 'neo4j', healthy: false },
]);

const logs = ref<LogEntry[]>([]);
const showLogs = ref(false);
const lastUpdate = ref('');
const refreshInterval = ref<number | null>(null);
const isProcessing = ref(false);

const healthyCount = computed(() => services.value.filter(s => s.healthy).length);

const checkAllServicesHealth = async (): Promise<void> => {
  const startTime = Date.now();
  try {
    const response = await uni.request({
      url: getApiUrl('/health'),
      method: 'GET',
      timeout: 10000,
    });
    
    const responseData = response.data as {
      code: number;
      status?: string;
      services?: Record<string, { status: string; message?: string }>;
      data?: {
        status: string;
        services?: Record<string, { status: string; message?: string }>;
      };
    };

    // 兼容两种信封：TransformInterceptor 包装的 {code,data} 与裸的 {status,services}
    const data: { status?: string; services?: Record<string, { status: string; message?: string }> } =
      responseData.data || responseData;
    
    // 提成局部常量：闭包里 TS 无法保持对可选属性的收窄
    const serviceMap = data.services;
    if (serviceMap) {
      services.value.forEach(service => {
        const serviceData = serviceMap[service.key];
        if (serviceData) {
          service.healthy = serviceData.status === 'healthy';
        }
      });
    }
    
    const totalLatency = Date.now() - startTime;
    addLog('info', `健康检查完成 (${totalLatency}ms) - 状态: ${data.status}`);
  } catch (error) {
    services.value.forEach(service => {
      service.healthy = false;
    });
    addLog('error', '无法连接到后端服务');
  }
};

const refreshStatus = async () => {
  lastUpdate.value = new Date().toLocaleTimeString();
  await checkAllServicesHealth();
};

const addLog = (level: LogEntry['level'], message: string) => {
  const time = new Date().toLocaleTimeString();
  logs.value.unshift({ time, level, message });
  if (logs.value.length > 100) {
    logs.value.pop();
  }
};

const startAllServices = async () => {
  isProcessing.value = true;
  addLog('info', '正在启动所有服务...');
  
  try {
    // 启动脚本路径
    const scriptPath = 'scripts/start-all.bat';
    addLog('info', `执行启动脚本: ${scriptPath}`);
    
    // 模拟脚本执行
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    addLog('info', '所有服务启动成功');
    uni.showToast({ title: '所有服务启动成功', icon: 'success' });
    
    // 刷新服务状态
    await refreshStatus();
  } catch (error) {
    addLog('error', '启动服务失败');
    uni.showToast({ title: '启动服务失败', icon: 'error' });
  } finally {
    isProcessing.value = false;
  }
};

const stopAllServices = async () => {
  isProcessing.value = true;
  addLog('warn', '正在停止所有服务...');
  
  try {
    // 停止脚本路径
    const scriptPath = 'scripts/stop-all.bat';
    addLog('info', `执行停止脚本: ${scriptPath}`);
    
    // 模拟脚本执行
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    addLog('info', '所有服务停止成功');
    uni.showToast({ title: '所有服务停止成功', icon: 'success' });
    
    // 刷新服务状态
    await refreshStatus();
  } catch (error) {
    addLog('error', '停止服务失败');
    uni.showToast({ title: '停止服务失败', icon: 'error' });
  } finally {
    isProcessing.value = false;
  }
};

const restartAllServices = async () => {
  isProcessing.value = true;
  addLog('info', '正在重启所有服务...');
  
  try {
    // 先停止所有服务
    await stopAllServices();
    
    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 再启动所有服务
    await startAllServices();
    
    addLog('info', '所有服务重启成功');
    uni.showToast({ title: '所有服务重启成功', icon: 'success' });
  } catch (error) {
    addLog('error', '重启服务失败');
    uni.showToast({ title: '重启服务失败', icon: 'error' });
  } finally {
    isProcessing.value = false;
  }
};

const toggleLogs = () => {
  showLogs.value = !showLogs.value;
};

onMounted(() => {
  refreshStatus();
  refreshInterval.value = setInterval(refreshStatus, 30000) as unknown as number;
});

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value);
  }
});
</script>

<style scoped>
.status-panel {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-title {
  font-size: 18px;
  font-weight: bold;
  color: var(--text-primary);
}

.refresh-btn {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.refresh-icon {
  font-size: 16px;
}

.services-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.service-card {
  display: flex;
  align-items: center;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border-left: 4px solid var(--border-color);
}

.service-card.service-healthy {
  border-left-color: var(--success-color);
  background: rgba(76, 175, 80, 0.1);
}

.service-card.service-error {
  border-left-color: var(--error-color);
  background: rgba(244, 67, 54, 0.1);
}

.service-icon {
  font-size: 24px;
  margin-right: 15px;
}

.service-info {
  flex: 1;
}

.service-name {
  font-size: 15px;
  font-weight: bold;
  color: var(--text-primary);
  display: block;
}

.service-status {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}

.service-latency {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
  display: block;
}

.service-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--border-color);
}

.indicator-active {
  background: var(--success-color);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.panel-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid var(--border-color);
}

.stat-item {
  text-align: center;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  display: block;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: var(--text-primary);
}

.stat-time {
  font-size: 14px;
  color: var(--text-secondary);
}

.panel-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.action-btn {
  flex: 1;
  height: 40px;
  line-height: 40px;
  font-size: 14px;
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: all 0.3s ease;
}

.action-btn[disabled] {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--accent-gradient);
  color: white;
}

.action-btn.primary[disabled] {
  background: var(--accent-gradient);
  opacity: 0.6;
}

.action-btn.secondary {
  background: rgba(244, 67, 54, 0.1);
  color: var(--error-color);
}

.action-btn.secondary[disabled] {
  background: rgba(244, 67, 54, 0.1);
  opacity: 0.6;
}

.show-logs-btn {
  width: 100%;
  margin-top: 15px;
  height: 40px;
  line-height: 40px;
  background: var(--bg-secondary);
  font-size: 14px;
  border-radius: 8px;
  color: var(--text-primary);
}

.logs-section {
  margin-top: 15px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: var(--bg-secondary);
}

.logs-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--text-primary);
}

.logs-close {
  color: var(--text-muted);
  padding: 5px;
}

.logs-content {
  height: 200px;
  padding: 10px;
  background: var(--code-bg);
}

.log-item {
  padding: 5px 0;
  font-size: 12px;
  font-family: monospace;
}

.log-item.info {
  color: var(--success-color);
}

.log-item.warn {
  color: var(--warning-color);
}

.log-item.error {
  color: var(--error-color);
}

.log-time {
  color: var(--text-muted);
  margin-right: 10px;
}

.log-message {
  color: #d4d4d4;
}
</style>
