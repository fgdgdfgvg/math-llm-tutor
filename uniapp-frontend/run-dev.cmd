@ECHO off
SET "NODE_EXE=c:\Users\欧阳晨\.trae-cn\binaries\node\versions\22.22.0\node.exe"
SET "UNI_JS=%~dp0\node_modules\@dcloudio\vite-plugin-uni\bin\uni.js"

ECHO Using Node.js: %NODE_EXE%
ECHO Running uni.js: %UNI_JS%

%NODE_EXE% "%UNI_JS%"
