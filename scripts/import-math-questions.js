const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// 连接到MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://root:123456@localhost:27017/math_llm_tutor?authSource=admin', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB连接成功');
  } catch (error) {
    console.error('❌ MongoDB连接失败:', error.message);
    process.exit(1);
  }
};

// 定义题目模型
const QuestionSchema = new mongoose.Schema({
  questionId: {
    type: String,
    required: true,
    unique: true
  },
  knowledgePoint: {
    type: String,
    required: true
  },
  subConcepts: {
    type: [String],
    default: []
  },
  chapterSource: {
    type: String
  },
  content: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['基础', '中等', '较难', '困难'],
    required: true
  },
  solutionSteps: {
    type: [String],
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  questionType: {
    type: String
  },
  score: {
    type: Number
  },
  estimatedTime: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Question = mongoose.model('Question', QuestionSchema);

// 导入数据
const importQuestions = async () => {
  try {
    // 读取math.json文件
    const filePath = path.join(__dirname, '../datasets/math.json');
    const rawData = fs.readFileSync(filePath, 'utf8');
    const questions = JSON.parse(rawData);

    console.log(`📊 准备导入 ${questions.length} 道题目`);

    // 统计信息
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 批量导入
    for (const question of questions) {
      try {
        // 转换数据结构
        const questionData = {
          questionId: question['题目编号'],
          knowledgePoint: question['知识点'],
          subConcepts: question['关联子概念'] || [],
          chapterSource: question['章节来源'],
          content: question['题目内容'],
          difficulty: question['难度等级'],
          solutionSteps: question['详细解法步骤'] || [],
          answer: question['答案'],
          questionType: question['题型'],
          score: question['分值'],
          estimatedTime: question['预计用时']
        };

        // 检查是否已存在
        const existing = await Question.findOne({ questionId: questionData.questionId });
        if (existing) {
          // 更新现有记录
          await Question.updateOne({ questionId: questionData.questionId }, questionData);
          console.log(`🔄 更新题目: ${questionData.questionId}`);
        } else {
          // 创建新记录
          await Question.create(questionData);
          console.log(`✅ 导入题目: ${questionData.questionId}`);
        }
        successCount++;
      } catch (error) {
        console.error(`❌ 导入失败 ${question['题目编号']}:`, error.message);
        errors.push({ questionId: question['题目编号'], error: error.message });
        errorCount++;
      }
    }

    // 生成导入报告
    console.log('\n📋 导入报告:');
    console.log(`总题目数: ${questions.length}`);
    console.log(`成功导入: ${successCount}`);
    console.log(`导入失败: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n❌ 失败详情:');
      errors.forEach(err => {
        console.log(`- ${err.questionId}: ${err.error}`);
      });
    }

    // 验证导入结果
    const totalInDB = await Question.countDocuments();
    console.log(`\n✅ 数据库中总题目数: ${totalInDB}`);

  } catch (error) {
    console.error('❌ 导入过程出错:', error.message);
  } finally {
    // 关闭数据库连接
    await mongoose.disconnect();
    console.log('\n🔌 数据库连接已关闭');
  }
};

// 执行导入
const run = async () => {
  console.log('🚀 开始导入数学题库数据...');
  await connectDB();
  await importQuestions();
  console.log('🎉 导入完成!');
};

run();