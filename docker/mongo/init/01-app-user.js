// MongoDB 首次初始化脚本（官方镜像以 root 身份在空数据卷上执行 /docker-entrypoint-initdb.d/*.js）
//
// 代码审阅 3.x：docker/mongo/init 此前是空目录，compose 却已挂载它。
// 这里补上最小权限应用账号的创建：数据库端口虽然只绑定回环，但应用不应该
// 一律用 root 连接；配置 MONGO_APP_USER / MONGO_APP_PASSWORD 后即可改用：
//   MONGODB_URI=mongodb://<app-user>:<app-password>@mongodb:27017/math_llm_tutor?authSource=math_llm_tutor
//
// 未配置这两个变量时脚本只打印提示，不创建任何账号（保持默认 root 连接可用）。

const appDbName = process.env.MONGO_INITDB_DATABASE || 'math_llm_tutor';
const appUser = (process.env.MONGO_APP_USER || '').trim();
const appPassword = process.env.MONGO_APP_PASSWORD || '';

const appDb = db.getSiblingDB(appDbName);

if (!appUser || !appPassword) {
  print(
    `[init] 未配置 MONGO_APP_USER / MONGO_APP_PASSWORD，跳过最小权限账号创建（应用库：${appDbName}）`,
  );
} else if (appDb.getUser(appUser)) {
  print(`[init] 应用账号 ${appUser} 已存在，跳过`);
} else {
  appDb.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [{ role: 'readWrite', db: appDbName }],
  });
  print(`[init] 已创建最小权限应用账号 ${appUser}（readWrite@${appDbName}）`);
}
