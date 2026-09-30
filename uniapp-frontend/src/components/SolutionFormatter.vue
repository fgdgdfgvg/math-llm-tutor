<template>
  <view class="solution-formatter">
    <view v-for="(block, index) in formattedBlocks" :key="index" class="content-block">
      <view v-if="block.type === 'title'" class="block-title">
        <text class="title-icon">{{ block.icon }}</text>
        <text class="title-text">{{ block.content }}</text>
      </view>
      
      <view v-else-if="block.type === 'step'" class="block-step">
        <view class="step-header">
          <view class="step-number-badge">{{ block.order }}</view>
          <text class="step-title">{{ block.title }}</text>
        </view>
        <view class="step-body">
          <text class="step-content">{{ block.content }}</text>
        </view>
      </view>
      
      <view v-else-if="block.type === 'formula'" class="block-formula">
        <view class="formula-container">
          <text class="formula-content">{{ block.content }}</text>
        </view>
      </view>
      
      <view v-else-if="block.type === 'code'" class="block-code">
        <view class="code-header">
          <text class="code-lang">{{ block.lang || '数学表达式' }}</text>
          <text class="code-copy" @click="copyCode(block.content)">复制</text>
        </view>
        <view class="code-body">
          <text class="code-content">{{ block.content }}</text>
        </view>
      </view>
      
      <view v-else-if="block.type === 'list'" class="block-list">
        <view v-for="(item, idx) in block.items" :key="idx" class="list-item">
          <view class="list-bullet">{{ block.ordered ? (idx + 1) + '.' : '•' }}</view>
          <text class="list-text">{{ item }}</text>
        </view>
      </view>
      
      <view v-else-if="block.type === 'answer'" class="block-answer">
        <view class="answer-badge">最终答案</view>
        <text class="answer-content">{{ block.content }}</text>
      </view>
      
      <view v-else-if="block.type === 'warning'" class="block-warning">
        <text class="warning-icon">⚠️</text>
        <text class="warning-text">{{ block.content }}</text>
      </view>
      
      <view v-else-if="block.type === 'tip'" class="block-tip">
        <text class="tip-icon">💡</text>
        <text class="tip-text">{{ block.content }}</text>
      </view>
      
      <view v-else-if="block.type === 'paragraph'" class="block-paragraph">
        <text class="paragraph-text">{{ block.content }}</text>
      </view>
      
      <view v-else-if="block.type === 'divider'" class="block-divider"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface ContentBlock {
  type: string;
  content?: string;
  order?: number;
  title?: string;
  items?: string[];
  ordered?: boolean;
  icon?: string;
  lang?: string;
}

const props = defineProps<{
  content: string;
}>();

const formattedBlocks = computed(() => {
  return parseContent(props.content);
});

const parseContent = (text: string): ContentBlock[] => {
  const blocks: ContentBlock[] = [];
  const lines = text.split('\n');
  
  let currentParagraph = '';
  let stepCounter = 0;
  
  const flushParagraph = () => {
    if (currentParagraph.trim()) {
      blocks.push({
        type: 'paragraph',
        content: currentParagraph.trim(),
      });
      currentParagraph = '';
    }
  };
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) {
      flushParagraph();
      continue;
    }
    
    if (line.match(/^#{1,3}\s/)) {
      flushParagraph();
      const titleText = line.replace(/^#{1,3}\s*/, '');
      const icon = titleText.includes('步骤') ? '📝' : 
                   titleText.includes('分析') ? '🔍' :
                   titleText.includes('知识点') ? '📚' :
                   titleText.includes('答案') ? '✅' : '📌';
      blocks.push({
        type: 'title',
        content: titleText,
        icon,
      });
      continue;
    }
    
    if (line.match(/^(步骤|Step)\s*\d+[：:.]/i)) {
      flushParagraph();
      stepCounter++;
      const titleMatch = line.match(/^(?:步骤|Step)\s*(\d+)[：:.]?\s*(.*)$/i);
      if (titleMatch) {
        blocks.push({
          type: 'step',
          order: parseInt(titleMatch[1]) || stepCounter,
          title: titleMatch[2] || `解题步骤 ${stepCounter}`,
          content: '',
        });
      }
      continue;
    }
    
    if (line.match(/^(\d+)[\.、）]\s/)) {
      flushParagraph();
      const listItems: string[] = [];
      let j = i;
      while (j < lines.length) {
        const listMatch = lines[j].trim().match(/^(\d+)[\.、）]\s*(.+)$/);
        if (listMatch) {
          listItems.push(listMatch[2]);
          j++;
        } else {
          break;
        }
      }
      if (listItems.length > 0) {
        blocks.push({
          type: 'list',
          items: listItems,
          ordered: true,
        });
        i = j - 1;
      }
      continue;
    }
    
    if (line.match(/^[-•·]\s/)) {
      flushParagraph();
      const listItems: string[] = [];
      let j = i;
      while (j < lines.length) {
        const listMatch = lines[j].trim().match(/^[-•·]\s*(.+)$/);
        if (listMatch) {
          listItems.push(listMatch[1]);
          j++;
        } else {
          break;
        }
      }
      if (listItems.length > 0) {
        blocks.push({
          type: 'list',
          items: listItems,
          ordered: false,
        });
        i = j - 1;
      }
      continue;
    }
    
    if (line.match(/^[`]{3,}/)) {
      flushParagraph();
      const langMatch = line.match(/^[`]{3,}(\w*)/);
      const lang = langMatch ? langMatch[1] : '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().match(/^[`]{3,}/)) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        lang: lang || '数学表达式',
      });
      continue;
    }
    
    if (line.match(/^\$[^$]+\$$/) || line.match(/^\$\$[^$]+\$\$$/)) {
      flushParagraph();
      const formula = line.replace(/^\$+\s*/, '').replace(/\s*\$+$/, '');
      blocks.push({
        type: 'formula',
        content: formula,
      });
      continue;
    }
    
    if (line.match(/^(答案|最终答案|Answer)[：:]/i)) {
      flushParagraph();
      const answerMatch = line.match(/^(?:答案|最终答案|Answer)[：:]\s*(.+)$/i);
      if (answerMatch) {
        blocks.push({
          type: 'answer',
          content: answerMatch[1],
        });
      }
      continue;
    }
    
    if (line.match(/^(⚠️|警告|注意|Warning)/)) {
      flushParagraph();
      const warningText = line.replace(/^(⚠️|警告|注意|Warning)[：:]?\s*/, '');
      blocks.push({
        type: 'warning',
        content: warningText,
      });
      continue;
    }
    
    if (line.match(/^(💡|提示|Tip)/)) {
      flushParagraph();
      const tipText = line.replace(/^(💡|提示|Tip)[：:]?\s*/, '');
      blocks.push({
        type: 'tip',
        content: tipText,
      });
      continue;
    }
    
    if (line.match(/^---+$/)) {
      flushParagraph();
      blocks.push({ type: 'divider' });
      continue;
    }
    
    if (line.includes('=') && line.match(/[a-zA-Z]/) && line.length > 5) {
      if (line.match(/^[a-zA-Z]\s*[=≈]/) || line.match(/\w+\([^)]*\)\s*=/)) {
        flushParagraph();
        blocks.push({
          type: 'formula',
          content: line,
        });
        continue;
      }
    }
    
    if (line.match(/[∫∑∏∂∇√∞±×÷]/)) {
      flushParagraph();
      blocks.push({
        type: 'formula',
        content: line,
      });
      continue;
    }
    
    currentParagraph += (currentParagraph ? '\n' : '') + line;
  }
  
  flushParagraph();
  
  return mergeConsecutiveBlocks(blocks);
};

const mergeConsecutiveBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  const merged: ContentBlock[] = [];
  
  for (const block of blocks) {
    const lastBlock = merged[merged.length - 1];
    
    if (lastBlock && lastBlock.type === 'step' && block.type === 'paragraph') {
      lastBlock.content = (lastBlock.content || '') + '\n' + (block.content || '');
    } else if (lastBlock && lastBlock.type === 'paragraph' && block.type === 'paragraph') {
      lastBlock.content = (lastBlock.content || '') + '\n\n' + (block.content || '');
    } else {
      merged.push({ ...block });
    }
  }
  
  return merged;
};

const copyCode = (code: string) => {
  uni.setClipboardData({
    data: code,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'success' });
    },
  });
};
</script>

<style scoped>
.solution-formatter {
  padding: 15px;
}

.content-block {
  margin-bottom: 16px;
}

.block-title {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
  margin-bottom: 12px;
}

.title-icon {
  font-size: 20px;
  margin-right: 10px;
}

.title-text {
  font-size: 16px;
  font-weight: bold;
  color: white;
}

.block-step {
  background: #f8f9fa;
  border-radius: 10px;
  overflow: hidden;
  border-left: 4px solid #667eea;
}

.step-header {
  display: flex;
  align-items: center;
  padding: 12px 15px;
  background: #e8eaff;
}

.step-number-badge {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
}

.step-title {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

.step-body {
  padding: 15px;
}

.step-content {
  font-size: 14px;
  color: #333;
  line-height: 1.8;
  white-space: pre-line;
}

.block-formula {
  padding: 15px;
  background: #fff8e1;
  border-radius: 10px;
  border: 1px solid #ffd54f;
}

.formula-container {
  text-align: center;
}

.formula-content {
  font-family: 'Times New Roman', 'KaTeX_Main', serif;
  font-size: 18px;
  color: #333;
  letter-spacing: 1px;
}

.block-code {
  background: #1e1e1e;
  border-radius: 10px;
  overflow: hidden;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 15px;
  background: #2d2d2d;
}

.code-lang {
  font-size: 12px;
  color: #888;
}

.code-copy {
  font-size: 12px;
  color: #667eea;
  padding: 4px 10px;
  background: #3d3d3d;
  border-radius: 4px;
}

.code-body {
  padding: 15px;
  overflow-x: auto;
}

.code-content {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 14px;
  color: #d4d4d4;
  line-height: 1.6;
  white-space: pre;
}

.block-list {
  padding: 10px 15px;
  background: #fafafa;
  border-radius: 10px;
}

.list-item {
  display: flex;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.list-item:last-child {
  border-bottom: none;
}

.list-bullet {
  width: 24px;
  font-size: 14px;
  color: #667eea;
  font-weight: bold;
}

.list-text {
  flex: 1;
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.block-answer {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  text-align: center;
}

.answer-badge {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 15px;
  font-size: 12px;
  color: white;
  margin-bottom: 10px;
}

.answer-content {
  display: block;
  font-size: 22px;
  font-weight: bold;
  color: white;
  font-family: 'Times New Roman', serif;
}

.block-warning {
  display: flex;
  align-items: flex-start;
  padding: 12px 15px;
  background: #fff3e0;
  border-radius: 10px;
  border-left: 4px solid #ff9800;
}

.warning-icon {
  font-size: 18px;
  margin-right: 10px;
}

.warning-text {
  flex: 1;
  font-size: 14px;
  color: #e65100;
  line-height: 1.6;
}

.block-tip {
  display: flex;
  align-items: flex-start;
  padding: 12px 15px;
  background: #e3f2fd;
  border-radius: 10px;
  border-left: 4px solid #2196f3;
}

.tip-icon {
  font-size: 18px;
  margin-right: 10px;
}

.tip-text {
  flex: 1;
  font-size: 14px;
  color: #1565c0;
  line-height: 1.6;
}

.block-paragraph {
  padding: 5px 0;
}

.paragraph-text {
  font-size: 15px;
  color: #333;
  line-height: 1.8;
  white-space: pre-line;
}

.block-divider {
  height: 1px;
  background: #e0e0e0;
  margin: 15px 0;
}
</style>
