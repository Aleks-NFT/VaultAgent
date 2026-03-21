#!/bin/bash
cd /workspaces/AgentVault/mcp-server && npx tsx http-server.ts &
cd /workspaces/AgentVault/hub && npx next dev -p 3000
