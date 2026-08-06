import React, { useState } from 'react';
import PageLayout from '../components/common/PageLayout';
import { useMetricsContext } from '../context/MetricsContext';
import { useAlerts } from '../context/AlertsContext';
import { useActivity } from '../context/ActivityContext';
import { formatBytes } from '../utils/formatters';
import { fetchHistoricalMetrics } from '../api/metricsApi';

const ReportsPage = () => {
  const { current, agents = {}, historyMap = {} } = useMetricsContext();
  const { alerts } = useAlerts();
  const { logs } = useActivity();
  const [selectedServerId, setSelectedServerId] = useState('');
  const [reportType, setReportType] = useState('snapshot');
  const [format, setFormat] = useState('json');
  const [generatedReport, setGeneratedReport] = useState(null);
  const [historyReports, setHistoryReports] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const agentKeys = Object.keys(agents);
  const activeServerId = selectedServerId || agentKeys[0] || '';
  const activeAgent = agents[activeServerId] || current;

  const generateReport = async () => {
    setIsGenerating(true);
    let reportData = {};
    const timestamp = new Date().toISOString();
    const serverName = activeAgent?.name || activeServerId || 'Primary Server';

    try {
      if (reportType === 'snapshot') {
        reportData = {
          title: `System Metrics Snapshot Report (${serverName})`,
          timestamp,
          serverId: activeServerId,
          metrics: activeAgent ? {
            cpu: {
              usage: `${(activeAgent.cpu?.usage ?? 0).toFixed(1)}%`,
              model: activeAgent.cpu?.model || 'Cloud VM Processor',
              cores: activeAgent.cpu?.cores || 1
            },
            memory: {
              total: formatBytes(activeAgent.memory?.total || 0),
              used: formatBytes(activeAgent.memory?.used || 0),
              free: formatBytes(activeAgent.memory?.free || 0),
              usagePercent: `${(activeAgent.memory?.usagePercent ?? 0).toFixed(1)}%`
            },
            disks: (activeAgent.disks || activeAgent.disk || []).map(d => ({
              fs: d.fs || 'ext4',
              size: formatBytes(d.size || 0),
              used: formatBytes(d.used || 0),
              usagePercent: `${(d.usagePercent ?? 0).toFixed(1)}%`,
              mount: d.mount || '/'
            })),
            uptime: `${Math.floor((activeAgent.os?.uptime || activeAgent.uptime || 0) / 3600)} hours`
          } : 'No metrics available'
        };
      } else if (reportType === 'alerts') {
        reportData = {
          title: 'System Alerts History Report',
          timestamp,
          alertsCount: alerts.length,
          alerts: alerts.map(a => ({
            time: a.timestamp,
            severity: a.severity,
            title: a.title,
            message: a.message
          }))
        };
      } else if (reportType === 'activity') {
        reportData = {
          title: 'User Activity Logs Report',
          timestamp,
          logsCount: logs.length,
          logs: logs.map(l => ({
            time: l.timestamp,
            type: l.type,
            action: l.action,
            detail: l.detail
          }))
        };
      } else {
        // Fetch historical snapshots from backend API
        const apiRes = await fetchHistoricalMetrics(300, activeServerId).catch(() => ({ data: [] }));
        const snapshots = apiRes?.data?.length ? apiRes.data : (historyMap[activeServerId] || []);

        const cpuArr = snapshots.map(s => s.cpu?.usage ?? 0);
        const ramArr = snapshots.map(s => s.memory?.usagePercent ?? 0);

        const avgCpu = cpuArr.length ? (cpuArr.reduce((a, b) => a + b, 0) / cpuArr.length) : 0;
        const maxCpu = cpuArr.length ? Math.max(...cpuArr) : 0;
        const avgRam = ramArr.length ? (ramArr.reduce((a, b) => a + b, 0) / ramArr.length) : 0;
        const maxRam = ramArr.length ? Math.max(...ramArr) : 0;

        reportData = {
          title: `Historical Trends Summary Report (${serverName})`,
          timestamp,
          serverId: activeServerId,
          dataPointsCount: snapshots.length,
          aggregates: {
            averageCpuUsage: `${avgCpu.toFixed(1)}%`,
            peakCpuUsage: `${maxCpu.toFixed(1)}%`,
            averageMemoryUsage: `${avgRam.toFixed(1)}%`,
            peakMemoryUsage: `${maxRam.toFixed(1)}%`,
          }
        };
      }

      setGeneratedReport(reportData);
      setHistoryReports(prev => [
        { id: Date.now().toString(), title: reportData.title, timestamp, type: reportType },
        ...prev.slice(0, 4)
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReport = () => {
    if (!generatedReport) return;
    let content = '';
    let mimeType = 'application/json';
    let filename = `report_${reportType}_${Date.now()}`;

    if (format === 'json') {
      content = JSON.stringify(generatedReport, null, 2);
      filename += '.json';
    } else {
      // CSV Export (simplistic flattening)
      mimeType = 'text/csv';
      filename += '.csv';
      
      if (reportType === 'snapshot') {
        content = `Metric,Value\n`;
        content += `Report,${generatedReport.title}\n`;
        content += `Generated,${generatedReport.timestamp}\n`;
        if (current) {
          content += `CPU Usage,${generatedReport.metrics.cpu?.usage}\n`;
          content += `CPU Model,${generatedReport.metrics.cpu?.model}\n`;
          content += `RAM Usage,${generatedReport.metrics.memory?.usagePercent}\n`;
          content += `Uptime,${generatedReport.metrics.uptime}\n`;
        }
      } else if (reportType === 'alerts') {
        content = `Time,Severity,Title,Message\n`;
        generatedReport.alerts.forEach(a => {
          content += `"${a.time}","${a.severity}","${a.title}","${a.message.replace(/"/g, '""')}"\n`;
        });
      } else if (reportType === 'activity') {
        content = `Time,Type,Action,Detail\n`;
        generatedReport.logs.forEach(l => {
          content += `"${l.time}","${l.type}","${l.action}","${(l.detail || '').replace(/"/g, '""')}"\n`;
        });
      } else {
        content = `Metric,Value\n`;
        content += `Report,${generatedReport.title}\n`;
        content += `Data Points,${generatedReport.dataPointsCount}\n`;
        content += `Avg CPU,${generatedReport.aggregates.averageCpuUsage}\n`;
        content += `Avg RAM,${generatedReport.aggregates.averageMemoryUsage}\n`;
      }
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <PageLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">📄 Reports</h1>
          <p className="page-sub">Generate, preview and download system metrics reports</p>
        </div>
      </div>

      <div className="reports-grid">
        <div className="card reports-control-card">
          <h3 className="section-subtitle">Generate New Report</h3>

          {agentKeys.length > 0 && (
            <div className="form-group mb-4">
              <label className="form-label">Select Server</label>
              <select
                value={activeServerId}
                onChange={(e) => setSelectedServerId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: '600',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {agentKeys.map((key) => {
                  const ag = agents[key];
                  return (
                    <option key={key} value={key}>
                      🖥️ {ag?.name || key} ({ag?.ip || 'remote'})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Report Type</label>
            <div className="report-type-options">
              {[
                { id: 'snapshot', label: '📊 System Snapshot', desc: 'Current CPU, RAM, and Disk metrics' },
                { id: 'historical', label: '📈 Historical Summary', desc: 'Averages and trends from metrics history' },
                { id: 'alerts', label: '🚨 Active Alerts', desc: 'List of threshold violations' },
                { id: 'activity', label: '📋 User Activity Logs', desc: 'Auth, login, and administrative logs' }
              ].map(opt => (
                <div 
                  key={opt.id} 
                  className={`report-option ${reportType === opt.id ? 'active' : ''}`}
                  onClick={() => setReportType(opt.id)}
                >
                  <strong>{opt.label}</strong>
                  <p>{opt.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group mt-4">
            <label className="form-label">Export Format</label>
            <div className="format-tabs">
              <button className={`format-tab ${format === 'json' ? 'active' : ''}`} onClick={() => setFormat('json')}>JSON</button>
              <button className={`format-tab ${format === 'csv' ? 'active' : ''}`} onClick={() => setFormat('csv')}>CSV Spreadsheet</button>
            </div>
          </div>

          <button className="btn-primary mt-6 w-full" onClick={generateReport}>Generate Report ✨</button>
        </div>

        <div className="card reports-history-card">
          <h3 className="section-subtitle">Recent Reports</h3>
          {historyReports.length === 0 ? (
            <div className="reports-empty-state">
              <span className="empty-icon">📁</span>
              <p>No reports generated in this session yet</p>
            </div>
          ) : (
            <div className="reports-history-list">
              {historyReports.map(rep => (
                <div key={rep.id} className="history-report-item">
                  <div className="history-report-info">
                    <span className="history-report-title">{rep.title}</span>
                    <span className="history-report-time">{new Date(rep.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <span className="history-report-type">{rep.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {generatedReport && (
        <div className="card report-preview-card mt-6">
          <div className="report-preview-header">
            <div className="report-preview-title-block">
              <span className="preview-status-dot" />
              <h3>{generatedReport.title}</h3>
            </div>
            <div className="report-preview-actions">
              <button className="btn-secondary btn-sm" onClick={triggerPrint}>🖨️ Print / PDF</button>
              <button className="btn-primary btn-sm" onClick={downloadReport}>⬇ Download File</button>
            </div>
          </div>
          
          <div className="report-preview-content">
            <pre className="report-pre">{JSON.stringify(generatedReport, null, 2)}</pre>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default ReportsPage;
