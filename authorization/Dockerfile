# Dockerfile
FROM node

# 设置工作目录
WORKDIR /usr/src/app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制其余的应用代码
COPY . .

# 启动应用
CMD ["npm", "start"]