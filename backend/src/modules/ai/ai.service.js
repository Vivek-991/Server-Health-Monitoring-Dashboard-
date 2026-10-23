const logger = require('../../utils/logger');

// Runtime in-memory AI configuration (can be updated via Settings page or loaded from env)
const aiConfig = {
  enabled: process.env.AI_ENABLED !== 'false',
  provider: process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'builtin'),
  apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  temperature: 0.3,
  systemPersona: 'You are MonitorX AI SRE Copilot, an elite Site Reliability Engineer and DevOps AI Agent embedded in the MonitorX Server Health Monitoring Dashboard. You specialize in Linux/Unix systems, cloud VM performance (AWS EC2, VPS), containerized environments, disk space remediation, memory leak debugging, process profiling, and high-availability architecture. Always give concise, actionable answers with safe, real bash/terminal commands.',
};

/**
 * Built-in Rule-Based Heuristic SRE Analyzer.
 * Runs instantly without requiring any external API key.
 */
function analyzeWithHeuristics(serverData) {
  const server = serverData || {};
  const serverName = server.name || server.hostname || server.serverId || 'Target Server';
  const status = (server.status || 'online').toLowerCase();
  const isOffline = status === 'offline';

  const cpu = server.cpu || {};
  const cpuUsage = Number(cpu.usage ?? 0);
  const cpuCores = Number(cpu.cores ?? 1);
  const load = server.load || {};
  const avgLoad = Number(load.avgLoad ?? load.currentLoad ?? 0);

  const memory = server.memory || {};
  const memUsagePercent = Number(memory.usagePercent ?? 0);
  const memTotalBytes = Number(memory.total ?? 0);
  const memUsedBytes = Number(memory.used ?? 0);
  const memFreeMB = Math.round((memTotalBytes - memUsedBytes) / (1024 * 1024));

  const disks = server.disks || server.disk || [];
  const primaryDisk = disks.find(d => !d.mount?.startsWith('/snap') && d.fs !== 'squashfs') || disks[0] || {};
  const diskUsagePercent = Number(primaryDisk.usagePercent ?? 0);
  const diskMount = primaryDisk.mount || '/';

  const network = server.network || {};
  const rxSec = Number(network.rx_sec ?? 0);
  const txSec = Number(network.tx_sec ?? 0);
  const totalNetKB = Math.round((rxSec + txSec) / 1024);

  const recommendations = [];
  const anomalies = [];
  let penalty = 0;

  // 1. Check Offline Status
  if (isOffline) {
    anomalies.push(`Server heartbeat lost: ${serverName} is offline or unreachable`);
    penalty += 60;
    recommendations.push({
      id: 'rec-agent-heartbeat',
      title: 'Restore MonitorX Agent Connectivity',
      category: 'reliability',
      severity: 'critical',
      impact: 'Critical - Telemetry monitoring has ceased',
      effort: '1-3 mins',
      description: `The monitoring agent on ${serverName} has not communicated recently. Check if the server is powered on, if network egress is open, and if the background daemon is running.`,
      command: 'sudo systemctl status monitorx-agent.service || sudo systemctl restart monitorx-agent.service',
      verificationCommand: 'curl -I http://localhost:5000/api/metrics/live',
    });
  }

  // 2. Check CPU Saturation
  if (!isOffline && cpuUsage >= 85) {
    anomalies.push(`Critical CPU Thrashing: CPU utilization is at ${cpuUsage.toFixed(1)}% across ${cpuCores} core(s)`);
    penalty += 35;
    recommendations.push({
      id: 'rec-cpu-high',
      title: 'Inspect & Throttle High-CPU Processes',
      category: 'performance',
      severity: 'critical',
      impact: 'High - Prevents application request queuing and unresponsive timeouts',
      effort: '2 mins',
      description: `Sustained CPU usage above 85% causes thread starvation. Inspect top consumer processes, review runaway loops, and consider applying process priorities (nice/renice).`,
      command: `ps aux --sort=-%cpu | awk 'NR<=10{printf "%-8s %-6s %-5s %-5s %s\\n", $1, $2, $3, $4, $11}'`,
      verificationCommand: 'top -b -n 1 | head -n 15',
    });
  } else if (!isOffline && cpuUsage >= 70) {
    anomalies.push(`Elevated CPU Load: CPU utilization is running hot at ${cpuUsage.toFixed(1)}%`);
    penalty += 15;
    recommendations.push({
      id: 'rec-cpu-moderate',
      title: 'Optimize Worker Thread Concurrency & CPU Affinity',
      category: 'performance',
      severity: 'warning',
      impact: 'Medium - Smoothes spike handling during traffic bursts',
      effort: '5 mins',
      description: `CPU is operating near its capacity threshold. Ensure web servers (Nginx/Node/Gunicorn) have appropriate worker process counts matching your ${cpuCores} physical/virtual core(s).`,
      command: `lscpu | grep "CPU(s):\\|Model name\\|Thread"`,
      verificationCommand: 'mpstat 1 3 || top -n 1',
    });
  }

  // 3. Check Memory & OOM Risk
  if (!isOffline && memUsagePercent >= 88) {
    anomalies.push(`Memory Depletion: RAM usage is at ${memUsagePercent.toFixed(1)}% (${memFreeMB > 0 ? `${memFreeMB}MB free` : 'critically low'})`);
    penalty += 35;
    recommendations.push({
      id: 'rec-mem-critical',
      title: 'Purge Inactive OS Caches & Diagnose Memory Leaks',
      category: 'reliability',
      severity: 'critical',
      impact: 'Critical - Eliminates risk of Linux OOM (Out-Of-Memory) killer terminating core databases or services',
      effort: 'Immediate',
      description: `RAM allocation is nearing saturation. Identify top RSS processes and safely clear dentries and pagecaches if buffered.`,
      command: `ps aux --sort=-%mem | head -n 10 && sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches`,
      verificationCommand: 'free -m',
    });
  } else if (!isOffline && memUsagePercent >= 75) {
    anomalies.push(`Elevated Memory Usage: RAM utilization at ${memUsagePercent.toFixed(1)}%`);
    penalty += 15;
    recommendations.push({
      id: 'rec-mem-tuning',
      title: 'Tune Linux Swappiness & Memory Overcommit',
      category: 'performance',
      severity: 'warning',
      impact: 'Medium - Avoids premature swap thrashing on SSDs/NVMe storage',
      effort: '2 mins',
      description: `Default Linux swappiness (60) forces pages onto swap disk too aggressively. Setting it to 10 or 15 keeps active memory responsive.`,
      command: `sudo sysctl vm.swappiness=10 && echo "vm.swappiness=10" | sudo tee -a /etc/sysctl.d/99-sysctl.conf`,
      verificationCommand: 'cat /proc/sys/vm/swappiness',
    });
  }

  // 4. Check Disk Mount Capacity
  if (diskUsagePercent >= 88) {
    anomalies.push(`Storage Critical: Mount "${diskMount}" is at ${diskUsagePercent.toFixed(1)}% capacity`);
    penalty += 35;
    recommendations.push({
      id: 'rec-disk-critical',
      title: 'Vacuum Systemd Journals & Purge Package Caches',
      category: 'storage',
      severity: 'critical',
      impact: 'Critical - Prevents write failures, corrupted databases, and stalled system daemons',
      effort: '3 mins',
      description: `System storage is almost exhausted. Reclaim gigabytes by vacuuming historical systemd journals and deleting obsolete package archives.`,
      command: `sudo journalctl --vacuum-time=3d && sudo journalctl --vacuum-size=200M && sudo apt-get clean 2>/dev/null || sudo yum clean all 2>/dev/null`,
      verificationCommand: 'df -h ' + diskMount,
    });
  } else if (diskUsagePercent >= 75) {
    anomalies.push(`Storage Warning: Mount "${diskMount}" usage is at ${diskUsagePercent.toFixed(1)}%`);
    penalty += 15;
    recommendations.push({
      id: 'rec-disk-large-files',
      title: 'Locate & Rotate Uncompressed Logs & Large Files',
      category: 'storage',
      severity: 'warning',
      impact: 'Medium - Prevents unexpected disk fill-up before next automated rotation',
      effort: '5 mins',
      description: `Identify isolated large files (>100MB) such as unrotated application logs or temporary dumps.`,
      command: `sudo find /var/log -type f -size +50M -exec ls -lh {} + 2>/dev/null || df -h`,
      verificationCommand: 'du -sh /var/log/*',
    });
  }

  // 5. Check Network Activity
  if (!isOffline && totalNetKB > 40000) {
    anomalies.push(`High Network Traffic: Combined throughput exceeding ${totalNetKB} KB/s`);
    recommendations.push({
      id: 'rec-net-audit',
      title: 'Audit Active Socket Connections & Bandwidth Egress',
      category: 'security',
      severity: 'optimization',
      impact: 'Low - Validates legitimate traffic vs potential DDoS or scraping',
      effort: '2 mins',
      description: `Inspect established socket connections and packet transmission rates to rule out unauthorized access or runaway egress transfers.`,
      command: `ss -s && ss -tulpn | head -n 15`,
      verificationCommand: 'netstat -i || ip -s link',
    });
  }

  // 6. Proactive Hardening & Maintenance (Always provide at least 2 high quality suggestions)
  if (recommendations.length < 2) {
    recommendations.push({
      id: 'rec-proactive-security',
      title: 'Inspect Open Ports & Unattended Security Updates',
      category: 'security',
      severity: 'optimization',
      impact: 'Proactive - Hardens server perimeter against known CVEs',
      effort: '3 mins',
      description: `Verify that only mandatory ports (SSH, HTTP/HTTPS) are actively listening and ensure automatic security patches are enabled.`,
      command: `sudo ss -tlpn && sudo unattended-upgrade --dry-run 2>/dev/null || echo "Ports verified"`,
      verificationCommand: 'sudo ufw status verbose || sudo iptables -L -n -v',
    });
    recommendations.push({
      id: 'rec-proactive-limits',
      title: 'Verify File Descriptor (nofile) & TCP Socket Limits',
      category: 'reliability',
      severity: 'optimization',
      impact: 'Proactive - Eliminates "Too many open files" errors under peak concurrent workloads',
      effort: '2 mins',
      description: `Default system limits often restrict open file descriptors to 1024. Production web servers benefit from increasing this to 65536.`,
      command: `ulimit -n && cat /proc/sys/fs/file-max`,
      verificationCommand: 'sysctl fs.file-max',
    });
  }

  // Compute final health score & status
  const healthScore = Math.max(10, Math.min(100, Math.round(100 - penalty)));
  let statusLevel = 'healthy';
  let riskLevel = 'Low';

  if (isOffline || healthScore < 50) {
    statusLevel = 'critical';
    riskLevel = 'Critical';
  } else if (healthScore < 75) {
    statusLevel = 'warning';
    riskLevel = 'Moderate';
  }

  const summary = isOffline
    ? `⚠️ Server ${serverName} is currently OFFLINE. Monitoring telemetry is interrupted. Restoring the daemon connection is the primary priority.`
    : healthScore >= 85
    ? `✅ Server ${serverName} is operating within healthy parameters (Health Score: ${healthScore}/100). Resource headroom is optimal with no urgent bottlenecks.`
    : `⚠️ Server ${serverName} exhibits resource contention (Health Score: ${healthScore}/100). SRE attention is recommended to address ${anomalies[0] || 'detected bottlenecks'}.`;

  return {
    healthScore,
    statusLevel,
    riskLevel,
    summary,
    anomalies: anomalies.length ? anomalies : ['No critical anomalies detected in active metrics stream.'],
    recommendations,
    timestamp: new Date().toISOString(),
    engine: 'builtin-heuristic-sre',
  };
}

/**
 * Call Google Gemini Generative Language API
 */
async function callGemini(prompt, systemInstruction = '') {
  const apiKey = aiConfig.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please set it in Settings or GEMINI_API_KEY env.');
  }

  const model = aiConfig.geminiModel || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: aiConfig.temperature || 0.3,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstruction) {
    body.system_instruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`Gemini API Error (${response.status}): ${errorText}`);
    throw new Error(`Gemini API responded with status ${response.status}: ${errorText.substring(0, 150)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response text returned from Gemini API.');
  }
  return text;
}

/**
 * Call OpenAI Chat Completions API
 */
async function callOpenAI(messages, systemPrompt = '') {
  const apiKey = aiConfig.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API Key is missing. Please set it in Settings or OPENAI_API_KEY env.');
  }

  const model = aiConfig.openaiModel || 'gpt-4o-mini';
  const url = 'https://api.openai.com/v1/chat/completions';

  const fullMessages = [];
  if (systemPrompt) {
    fullMessages.push({ role: 'system', content: systemPrompt });
  }
  fullMessages.push(...messages);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: fullMessages,
      temperature: aiConfig.temperature || 0.3,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`OpenAI API Error (${response.status}): ${errorText}`);
    throw new Error(`OpenAI API responded with status ${response.status}: ${errorText.substring(0, 150)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No response text returned from OpenAI API.');
  }
  return text;
}

/**
 * Comprehensive Server Diagnosis.
 * Combines real-time telemetry, heuristic baseline, and LLM reasoning.
 */
async function diagnoseServer(serverTelemetry) {
  if (aiConfig.enabled === false) {
    return {
      healthScore: 100,
      statusLevel: 'healthy',
      riskLevel: 'Disabled',
      summary: 'AI SRE Copilot is currently disabled in Settings. Re-enable it to activate autonomous telemetry evaluation and playbooks.',
      anomalies: ['AI SRE Copilot is currently paused/disabled.'],
      recommendations: [],
      timestamp: new Date().toISOString(),
      engine: 'disabled',
      disabled: true,
    };
  }

  // First, always compute the high-accuracy baseline
  const heuristicResult = analyzeWithHeuristics(serverTelemetry);

  // If provider is set to builtin or no API key, return the heuristic diagnosis directly
  const activeProvider = aiConfig.provider;
  const hasKey = Boolean(aiConfig.apiKey || (activeProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY));

  if (activeProvider === 'builtin' || !hasKey) {
    return heuristicResult;
  }

  // Construct LLM prompt for deep analysis
  const prompt = `
You are an expert Linux/Unix Site Reliability Engineer (SRE).
Analyze the following live server telemetry and generate an advanced, structured diagnostic assessment with actionable recommendations.

Server Information:
${JSON.stringify(serverTelemetry, null, 2)}

Baseline Heuristic Evaluation:
- Health Score: ${heuristicResult.healthScore}
- Detected Issues: ${heuristicResult.anomalies.join('; ')}

Return ONLY valid JSON matching this exact schema:
{
  "healthScore": <integer 10-100>,
  "statusLevel": "healthy" | "warning" | "critical",
  "riskLevel": "Low" | "Moderate" | "Critical",
  "summary": "<2-3 sentence executive SRE summary of state>",
  "anomalies": ["<detected anomaly 1>", "<detected anomaly 2>"],
  "recommendations": [
    {
      "id": "<unique-slug>",
      "title": "<Concise recommendation title>",
      "category": "performance" | "storage" | "reliability" | "security",
      "severity": "critical" | "warning" | "optimization",
      "impact": "<e.g. High - Prevents OOM crash under spike>",
      "effort": "<e.g. 2 mins | Immediate | Scheduled>",
      "description": "<Detailed root-cause analysis and why this helps>",
      "command": "<Ready-to-run copyable Linux terminal command>",
      "verificationCommand": "<Verification command to check result>"
    }
  ]
}
Do NOT wrap your output in markdown code blocks like \`\`\`json. Return raw JSON only.
`;

  try {
    let rawText = '';
    if (activeProvider === 'gemini') {
      rawText = await callGemini(prompt, aiConfig.systemPersona);
    } else {
      rawText = await callOpenAI([{ role: 'user', content: prompt }], aiConfig.systemPersona);
    }

    // Clean markdown tags if model included them
    const cleanedText = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
    const parsed = JSON.parse(cleanedText);

    return {
      healthScore: parsed.healthScore ?? heuristicResult.healthScore,
      statusLevel: parsed.statusLevel || heuristicResult.statusLevel,
      riskLevel: parsed.riskLevel || heuristicResult.riskLevel,
      summary: parsed.summary || heuristicResult.summary,
      anomalies: parsed.anomalies || heuristicResult.anomalies,
      recommendations: Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
        ? parsed.recommendations
        : heuristicResult.recommendations,
      timestamp: new Date().toISOString(),
      engine: `${activeProvider}-llm`,
    };
  } catch (err) {
    logger.warn(`AI LLM diagnosis failed (${err.message}). Falling back gracefully to built-in heuristic engine.`);
    return {
      ...heuristicResult,
      engine: 'builtin-heuristic-fallback',
      warning: `LLM service unavailable (${err.message}). Using local SRE engine.`,
    };
  }
}

/**
 * Intelligent Chat with AI SRE Agent
 */
async function chatWithAgent(messages, serverContext = {}) {
  if (aiConfig.enabled === false) {
    return {
      role: 'assistant',
      content: '⚠️ **The MonitorX AI SRE Copilot is currently disabled in Settings.**\n\nYou can re-enable it anytime from **Settings ➔ 🤖 AI Agent** to activate live diagnosis, risk scoring, and interactive troubleshooting.',
      disabled: true,
    };
  }

  const activeProvider = aiConfig.provider;
  const hasKey = Boolean(aiConfig.apiKey || (activeProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY));

  const serverName = serverContext.name || serverContext.hostname || serverContext.id || 'Selected Server';
  const cpuVal = serverContext.cpu?.usage ? `${serverContext.cpu.usage.toFixed(1)}%` : 'N/A';
  const ramVal = serverContext.memory?.usagePercent ? `${serverContext.memory.usagePercent.toFixed(1)}%` : 'N/A';
  const diskVal = (serverContext.disks || serverContext.disk || [])[0]?.usagePercent
    ? `${(serverContext.disks || serverContext.disk)[0].usagePercent.toFixed(1)}%`
    : 'N/A';
  const statusVal = serverContext.status || 'online';

  const systemPrompt = `
${aiConfig.systemPersona}

Active Server Telemetry Context:
- Target Server: ${serverName} (Status: ${statusVal})
- CPU Utilization: ${cpuVal} (Cores: ${serverContext.cpu?.cores || 1})
- Memory Usage: ${ramVal}
- Primary Disk Usage: ${diskVal}
- OS: ${serverContext.os?.distro || serverContext.metadata?.os || 'Linux'}
- Raw Server Telemetry Snapshot:
${JSON.stringify(serverContext, null, 2)}

Instructions:
1. Ground your answers directly on this server's real metrics whenever relevant.
2. If asked about CPU, RAM, or Disks, reference the actual numbers shown above.
3. Provide safe, copyable shell commands using markdown code blocks.
4. Keep explanations concise, professional, and practical.
`;

  // If no external LLM configured, use the built-in conversational AI response generator
  if (activeProvider === 'builtin' || !hasKey) {
    const userMessage = messages[messages.length - 1]?.content || '';
    return generateBuiltinChatReply(userMessage, serverContext);
  }

  try {
    if (activeProvider === 'gemini') {
      // Format messages for Gemini
      const conversationText = messages
        .map(m => `${m.role === 'user' ? 'User' : 'SRE Assistant'}: ${m.content}`)
        .join('\n\n');
      const geminiPrompt = `${conversationText}\n\nSRE Assistant:`;
      const reply = await callGemini(geminiPrompt, systemPrompt);
      return reply;
    } else {
      // OpenAI format
      const formattedMessages = messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
      const reply = await callOpenAI(formattedMessages, systemPrompt);
      return reply;
    }
  } catch (err) {
    logger.warn(`AI Chat external call failed: ${err.message}. Using built-in conversational engine.`);
    const userMessage = messages[messages.length - 1]?.content || '';
    const fallbackReply = generateBuiltinChatReply(userMessage, serverContext);
    return `${fallbackReply}\n\n*(Note: Cloud LLM was unavailable: ${err.message}. Served by built-in MonitorX SRE engine.)*`;
  }
}

/**
 * Built-in Conversational SRE Engine for offline or zero-key usage
 */
function generateBuiltinChatReply(userPrompt, serverContext) {
  const prompt = (userPrompt || '').toLowerCase();
  const sName = serverContext.name || serverContext.hostname || 'the server';
  const cpu = serverContext.cpu?.usage ?? 0;
  const ram = serverContext.memory?.usagePercent ?? 0;
  const disk = (serverContext.disks || serverContext.disk || [])[0]?.usagePercent ?? 0;

  if (prompt.includes('cpu') || prompt.includes('processor') || prompt.includes('load')) {
    return `### 🖥️ CPU Health & Performance Analysis for **${sName}**

Current CPU utilization is **${cpu.toFixed(1)}%**.
${cpu > 80 ? '⚠️ **Alert:** CPU load is critical! Potential thread starvation.' : '✅ CPU utilization is within a healthy operating envelope.'}

**Immediate Diagnostic Commands:**
\`\`\`bash
# 1. View top 10 CPU-consuming processes in real-time
ps aux --sort=-%cpu | head -n 11

# 2. Inspect CPU core load and context switches
top -b -n 1 | head -n 20

# 3. Check hardware CPU architecture & frequency
lscpu | grep -E "Model name|CPU\\(s\\)|MHz"
\`\`\`

**Recommendations:**
- If a background worker or web server thread is looping, consider adjusting priority with \`renice +5 <PID>\`.
- Ensure multi-threaded services are pinned or scaled to the number of available cores.`;
  }

  if (prompt.includes('memory') || prompt.includes('ram') || prompt.includes('oom') || prompt.includes('swap')) {
    return `### 💾 Memory & Swap Diagnostics for **${sName}**

Current RAM utilization is **${ram.toFixed(1)}%**.
${ram > 85 ? '⚠️ **High Risk:** Risk of Linux Out-Of-Memory (OOM) killer terminating background databases or web workers!' : '✅ Memory usage is steady with sufficient buffer/cache room.'}

**Recommended Actions:**
\`\`\`bash
# 1. Inspect top memory consumers by Resident Set Size (RSS)
ps aux --sort=-%mem | head -n 11

# 2. View detailed memory & swap allocation in Megabytes
free -m

# 3. Safely reclaim dentries and pagecaches
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches

# 4. Tune swappiness to 10 (keeps RAM responsive)
sudo sysctl vm.swappiness=10
\`\`\``;
  }

  if (prompt.includes('disk') || prompt.includes('storage') || prompt.includes('space') || prompt.includes('clean')) {
    return `### 💿 Storage & Disk Space Optimization for **${sName}**

Primary disk usage is currently at **${disk.toFixed(1)}%**.
${disk > 80 ? '⚠️ **Critical:** Low disk space can lead to corrupted databases and crashed services!' : '✅ Disk allocation is healthy.'}

**Quick Disk Cleanup Playbook:**
\`\`\`bash
# 1. Check all mounted filesystems
df -h -x tmpfs -x devtmpfs

# 2. Clean systemd journal logs older than 3 days
sudo journalctl --vacuum-time=3d
sudo journalctl --vacuum-size=200M

# 3. Purge package caches (Ubuntu/Debian or RHEL)
sudo apt-get clean 2>/dev/null || sudo yum clean all 2>/dev/null

# 4. Find the largest 10 files (>100MB) on the system
sudo find / -xdev -type f -size +100M -exec ls -lh {} + 2>/dev/null | sort -k 5 -rh | head -n 10
\`\`\``;
  }

  if (prompt.includes('security') || prompt.includes('port') || prompt.includes('firewall') || prompt.includes('ssh')) {
    return `### 🛡️ Security & Ports Audit for **${sName}**

To harden **${sName}** and inspect active listening sockets:

\`\`\`bash
# 1. Audit all open listening TCP/UDP ports and owning processes
sudo ss -tulpn

# 2. Check firewall status (UFW on Ubuntu or iptables)
sudo ufw status verbose 2>/dev/null || sudo iptables -L -n -v

# 3. Check recent failed SSH login attempts
sudo grep "Failed password" /var/log/auth.log 2>/dev/null | tail -n 15

# 4. Install automatic security vulnerability patches
sudo apt-get install -y unattended-upgrades && sudo dpkg-reconfigure --priority=low unattended-upgrades
\`\`\``;
  }

  if (prompt.includes('report') || prompt.includes('summary') || prompt.includes('status') || prompt.includes('diagnos')) {
    const diag = analyzeWithHeuristics(serverContext);
    return `### 📊 AI SRE Executive Health Report: **${sName}**

- **Health Score:** \`${diag.healthScore}/100\` (${diag.riskLevel} Risk)
- **Status:** \`${diag.statusLevel.toUpperCase()}\`
- **CPU:** ${cpu.toFixed(1)}% | **RAM:** ${ram.toFixed(1)}% | **Disk:** ${disk.toFixed(1)}%

**Identified Findings:**
${diag.anomalies.map(a => `- ${a}`).join('\n')}

**Top Recommended Action:**
- **${diag.recommendations[0]?.title || 'System Stability Verification'}**
\`\`\`bash
${diag.recommendations[0]?.command || 'uptime && free -m && df -h'}
\`\`\`
*(Impact: ${diag.recommendations[0]?.impact || 'Preserves system health'})*`;
  }

  // Default helpful response
  return `### 🤖 MonitorX AI SRE Copilot

I have evaluated the telemetry for **${sName}** (CPU: **${cpu.toFixed(1)}%**, RAM: **${ram.toFixed(1)}%**, Disk: **${disk.toFixed(1)}%**).

Here is how I can assist you:
- **Diagnose performance bottlenecks:** Ask *"Why is my CPU or RAM high?"*
- **Reclaim storage:** Ask *"How do I safely free up disk space?"*
- **Security hardening:** Ask *"Audit my open ports and firewall"*
- **Incident reporting:** Ask *"Generate a server health summary report"*
- **Custom scripts:** Ask me for systemd, docker, or nginx optimization playbooks!

Feel free to ask any specific DevOps question or click one of the quick prompt suggestions below.`;
}

/**
 * Generate a comprehensive incident remediation playbook
 */
async function generateRemediationPlan(issueType, serverContext) {
  if (aiConfig.enabled === false) {
    return '⚠️ AI Remediation is currently disabled in Settings. Re-enable the AI Agent in Settings to generate playbooks.';
  }

  const serverName = serverContext.name || serverContext.hostname || 'Server';
  const activeProvider = aiConfig.provider;
  const hasKey = Boolean(aiConfig.apiKey || (activeProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY));

  const prompt = `
Generate a battle-tested, safe, automated bash remediation script for the following issue on server "${serverName}":
Issue: "${issueType}"
Telemetry Snapshot:
${JSON.stringify(serverContext, null, 2)}

Provide:
1. Executive Problem Summary
2. Pre-execution Safety Checks
3. Complete Step-by-Step Shell Script with comments
4. Verification & Rollback Procedure
`;

  if (activeProvider !== 'builtin' && hasKey) {
    try {
      if (activeProvider === 'gemini') {
        return await callGemini(prompt, aiConfig.systemPersona);
      } else {
        return await callOpenAI([{ role: 'user', content: prompt }], aiConfig.systemPersona);
      }
    } catch (err) {
      logger.warn(`Remediation generation failed: ${err.message}. Using built-in playbook.`);
    }
  }

  // Built-in playbook generator
  return `### 🛠️ Automated SRE Remediation Playbook: ${issueType}
**Target Server:** \`${serverName}\`
**Safety Level:** Safe (Non-destructive)

#### 1. Pre-execution Check
\`\`\`bash
# Create a temporary rollback checkpoint directory
mkdir -p /tmp/sre-checkpoint && cd /tmp/sre-checkpoint
date +"%Y-%m-%d %H:%M:%S" > checkpoint.log
\`\`\`

#### 2. Remediation Script
\`\`\`bash
#!/usr/bin/env bash
set -eo pipefail

echo "==> [MonitorX SRE] Initiating automated remediation for: ${issueType}..."

# Step 1: Sync filesystem buffers to avoid data loss
sync

# Step 2: Flush non-essential page caches
if [ "$EUID" -eq 0 ]; then
  echo 3 > /proc/sys/vm/drop_caches
  echo "==> Memory pagecaches cleared."
fi

# Step 3: Vacuum aged systemd journals (>200MB)
if command -v journalctl &>/dev/null; then
  journalctl --vacuum-size=200M || true
  echo "==> Journal logs trimmed."
fi

# Step 4: Refresh package manager caches
if command -v apt-get &>/dev/null; then
  apt-get clean || true
elif command -v yum &>/dev/null; then
  yum clean all || true
fi

echo "==> [MonitorX SRE] Remediation completed successfully!"
\`\`\`

#### 3. Verification Command
\`\`\`bash
free -m && df -h / && uptime
\`\`\``;
}

module.exports = {
  aiConfig,
  diagnoseServer,
  chatWithAgent,
  generateRemediationPlan,
  analyzeWithHeuristics,
};
