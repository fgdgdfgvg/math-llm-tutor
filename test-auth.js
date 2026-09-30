const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// 模拟用户模型
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  roles: { type: [String], default: ['student'] },
  email: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 模拟 pre-save 钩子
UserSchema.pre('save', async function() {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

const User = mongoose.model('User', UserSchema);

// 模拟 UserService 的 validateUser 方法
async function validateUser(username, pass) {
  console.log(`Validating user: ${username}, password: ${pass}`);

  // 添加测试账户，如果不存在则创建
  if (username === 'test' && pass === 'test123') {
    console.log('Processing test account');
    let testUser = await User.findOne({ username: 'test' }).exec();
    if (!testUser) {
      console.log('Creating test account');
      // 直接使用明文密码，让 pre-save 钩子自动哈希
      testUser = new User({
        username: 'test',
        password: 'test123',
      });
      await testUser.save();
      console.log('Test account created');
    }
    // 返回完整的用户对象（排除密码字段）
    const { password, ...result } = testUser.toObject();
    console.log(`Test account validated: ${JSON.stringify(result)}`);
    return result;
  }

  const user = await User.findOne({ username }).exec();
  console.log(`Found user: ${user ? 'yes' : 'no'}`);
  if (user) {
    console.log(`User password hash: ${user.password.substring(0, 20)}...`);
    const isMatch = await bcrypt.compare(pass, user.password);
    console.log(`Password match: ${isMatch}`);
    if (isMatch) {
      const { password, ...result } = user.toObject();
      return result;
    }
  }
  console.log(`User validation failed for: ${username}`);
  return null;
}

// 连接到 MongoDB
async function testAuth() {
  try {
    await mongoose.connect('mongodb://root:123456@localhost:27017/math_llm_tutor?authSource=admin');
    console.log('Connected to MongoDB');

    // 测试 test 账户登录
    console.log('\n=== Testing test account login ===');
    const testUser = await validateUser('test', 'test123');
    console.log('Test account login result:', testUser ? 'SUCCESS' : 'FAILED');

    // 测试错误密码登录
    console.log('\n=== Testing wrong password login ===');
    const wrongPasswordUser = await validateUser('test', 'wrongpassword');
    console.log('Wrong password login result:', wrongPasswordUser ? 'SUCCESS' : 'FAILED');

    // 测试不存在的用户登录
    console.log('\n=== Testing non-existent user login ===');
    const nonExistentUser = await validateUser('nonexistent', 'password');
    console.log('Non-existent user login result:', nonExistentUser ? 'SUCCESS' : 'FAILED');

    // 断开连接
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
  }
}

testAuth();
