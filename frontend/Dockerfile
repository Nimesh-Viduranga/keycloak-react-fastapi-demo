# Build React SPA, then serve via nginx (conf mounted from compose)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# Public Keycloak config (inlined by Vite at build time)
ARG VITE_KEYCLOAK_URL=http://localhost:8090
ARG VITE_KEYCLOAK_REALM=brandvisual
ARG VITE_CLIENT_ID=react-fastapi-demo
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_CLIENT_ID=$VITE_CLIENT_ID

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
