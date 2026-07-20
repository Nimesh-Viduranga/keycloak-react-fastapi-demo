# Build React SPA, then serve via nginx (conf mounted from compose)
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

# Public OIDC config (inlined by Vite at build time)
ARG VITE_KEYCLOAK_AUTHORITY=http://localhost:8090/realms/brandvisual
ARG VITE_CLIENT_ID=react-fastapi-demo
ENV VITE_KEYCLOAK_AUTHORITY=$VITE_KEYCLOAK_AUTHORITY
ENV VITE_CLIENT_ID=$VITE_CLIENT_ID

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
