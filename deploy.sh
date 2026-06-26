#!/bin/bash
# deploy.sh — ejecutar en el VPS en /opt/mediwork2
set -e

echo "=== [1/5] Levantando contenedores ==="
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "=== [2/5] Esperando que el backend arranque ==="
sleep 10
docker logs mediwork2-backend --tail 20

echo "=== [3/5] Generando token de agente ==="
AGENT_TOKEN=$(docker exec mediwork2-backend npx tsx src/scripts/create-agent-token.ts 2>/dev/null | grep -E '^ey' | head -1)
echo ""
echo "========================================"
echo "AGENT TOKEN:"
echo "$AGENT_TOKEN"
echo "========================================"
echo ""
echo "Guarda este token — lo necesitas para el Spring Boot."

echo "=== [4/5] Verificando API ==="
curl -s -H "Authorization: Bearer $AGENT_TOKEN" http://localhost:7000/api/agent/info | head -c 200
echo ""

echo "=== [5/5] Reconfigurando Spring Boot con integración Mediwork 2.0 ==="
echo "Corriendo: docker stop mediwork && docker rm mediwork"
echo "Luego se relanza con las nuevas env vars."
echo ""
echo "Ejecuta manualmente cuando tengas el token:"
echo "docker stop mediwork && docker rm mediwork"
echo "docker run -d --name mediwork --restart unless-stopped \\"
echo "  -p 8080:8080 \\"
echo "  -e MEDIWORK_API_URL=https://sistema.mediworkzac.com \\"
echo "  -e \"MEDIWORK_AGENT_TOKEN=\$AGENT_TOKEN\" \\"
echo "  <imagen-spring-boot>"
echo ""
echo "=== Deploy completo ==="
