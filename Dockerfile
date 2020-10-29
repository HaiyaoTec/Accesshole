FROM node:12-alpine

WORKDIR /usr/src/app

COPY *.js ./
COPY package.json ./

ENV AUTH_SECRET="accesshole" \
	AUTH_KEY="token" \
	AUTH_ENABLE=false \
	BASE_PATH="service" \
	ROUTERS="{}"

RUN ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo 'Asia/Shanghai' >/etc/timezone \
    && npm set registry https://registry.npm.taobao.org/ \
    && npm install

EXPOSE 8899

ENTRYPOINT node index.js