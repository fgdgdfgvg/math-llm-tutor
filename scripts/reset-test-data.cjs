/**
 * 演示数据重置脚本
 *
 * 自测过程会注册大量临时账号（e2e_/probe_/selftest_/assess_ 等），
 * 这个脚本只保留一个统一测试账号，并清空该账号之外的学习数据，
 * 方便对外演示时数据库是干净状态。
 *
 * 用法：
 *   node reset-test-data.cjs                # 保留 test / test123456（默认）
 *   node reset-test-data.cjs --keep demo    # 保留指定账号
 *   node reset-test-data.cjs --password 12345678
 *   node reset-test-data.cjs --keep demo --no-reset-password
 */
const path = require('path');
const { createRequire } = require('module');

// 依赖装在 nestjs-backend 里，这里显式按后端目录解析
// 脚本位于 scripts/ 子目录，仓库根为其上一级
const backendRequire = createRequire(path.join(__dirname, '..', 'nestjs-backend', 'package.json'));
const { MongoClient } = backendRequire('mongodb');
const bcrypt = backendRequire('bcrypt');

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(name);
  return index > -1 && args[index + 1] ? args[index + 1] : fallback;
};

const KEEP_USERNAME = readArg('--keep', 'test');
const PASSWORD = readArg('--password', 'test123456');
const RESET_PASSWORD = !args.includes('--no-reset-password');

const URI =
  process.env.MONGODB_URI ||
  'mongodb://tutor:tutor123@localhost:27017/math_llm_tutor?authSource=math_llm_tutor';

// 只清空“属于某个学习者”的集合，题库、图谱等公共数据不动
const PER_USER_COLLECTIONS = [
  'studentknowledges',
  'mistakes',
  'learningrecords',
  'learninginsights',
  'learningbehaviors',
  'dialoguesessions',
  'problems',
];

(async () => {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  const users = db.collection('users');
  const before = await users.find({}).project({ username: 1 }).toArray();
  console.log(`现有账号 ${before.length} 个，将保留：${KEEP_USERNAME}`);

  const kept = await users.findOne({ username: KEEP_USERNAME });
  if (!kept) {
    console.error(`❌ 账号 ${KEEP_USERNAME} 不存在，已中止（不做任何删除）`);
    await client.close();
    process.exit(1);
  }

  if (RESET_PASSWORD) {
    const hash = await bcrypt.hash(PASSWORD, 10);
    await users.updateOne(
      { _id: kept._id },
      { $set: { password: hash, roles: kept.roles?.length ? kept.roles : ['student'] } },
    );
    console.log(`🔑 已重置 ${KEEP_USERNAME} 的密码`);
  }

  const removedUsers = await users.deleteMany({ username: { $ne: KEEP_USERNAME } });
  console.log(`🗑️  删除账号：${removedUsers.deletedCount} 个`);

  for (const name of PER_USER_COLLECTIONS) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) continue;
    const removed = await db.collection(name).deleteMany({});
    if (removed.deletedCount > 0) {
      console.log(`🗑️  清空 ${name}：${removed.deletedCount} 条`);
    }
  }

  const remainingUsers = await users.find({}).project({ username: 1, roles: 1 }).toArray();
  console.log('\n=== 清理后的账号 ===');
  for (const u of remainingUsers) {
    console.log(`  ${u.username}  roles=${JSON.stringify(u.roles || [])}`);
  }
  console.log('\n公共数据（题库/图谱）保持不变。');

  await client.close();
})().catch((err) => {
  console.error('❌ 重置失败:', err.message);
  process.exit(1);
});
