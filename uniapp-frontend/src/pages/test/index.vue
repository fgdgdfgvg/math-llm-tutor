<template>
  <view class="test-page">
    <text class="test-title">测试页面</text>
    <text class="test-content">如果能看到这段文字，说明页面渲染正常</text>
    <view class="test-list">
      <view v-for="item in testItems" :key="item.id" class="test-item">
        {{ item.name }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const testItems = ref([
  { id: 1, name: '测试项 1' },
  { id: 2, name: '测试项 2' },
  { id: 3, name: '测试项 3' }
]);
</script>

<style scoped>
.test-page {
  padding: 20px;
  background: var(--bg-secondary);
  min-height: 100vh;
}

.test-title {
  font-size: 24px;
  font-weight: bold;
  color: var(--text-primary);
  margin-bottom: 20px;
  display: block;
}

.test-content {
  font-size: 16px;
  color: var(--text-secondary);
  margin-bottom: 30px;
  display: block;
}

.test-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.test-item {
  background: var(--bg-card);
  padding: 15px;
  border-radius: 8px;
  color: var(--text-primary);
}
</style>