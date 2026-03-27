// 2. 将后台管理系统挂载到 /admin (http://localhost:3000/admin)
app.use('/admin', express.static(path.join(__dirname, '../frontend/public')));
// 静态文件

app.use('/covers', express.static(config.coverDir));