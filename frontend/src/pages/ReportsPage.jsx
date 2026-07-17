import React, { useState } from 'react';
import PageLayout from '../components/common/PageLayout';
import { useMetricsContext } from '../context/MetricsContext';
import { useAlerts } from '../context/AlertsContext';
import { useActivity } from '../context/ActivityContext';
import { formatBytes } from '../utils/formatters';

const ReportsPage = () => {
  const { current, history } = useMetricsContext();
  const { alerts } = useAlerts();
  const { logs } = useActivity();
  const [reportType, setReportType] = useState('snapshot');
  const [format, setFormat] = useState('json');
  const [generatedReport, setGeneratedReport] = useState(null);
  const [historyReports, setHistoryReports] = useState([]);

  const generateReport = () => {
    let reportData = {};
    const timestamp = new Date().toISOString();

    if (reportType === 'snapshot') {
      reportData = {
        title: 'System Metrics Snapshot Report',
        timestamp,
        metrics: current ? {
          cpu: {
            usage: `${current.cpu?.usage?.toFixed(1)}%`,
            model: current.cpu?.model,
            cores: current.cpu?.cores
          },
          memory: {
            total: formatBytes(current.memory?.total),
            used: formatBytes(current.memory?.used),
            free: formatBytes(current.memory?.free),
            usagePercent: `${current.memory?.usagePercent?.toFixed(1)}%`
          },
          disks: current.disks?.map(d => ({
            fs: d.fs,
            size: formatBytes(d.size),
            used: formatBytes(d.used),
            usagePercent: `${d.usagePercent?.toFixed(1)}%`,
            mount: d.mount
          })),
          uptime: `${Math.floor((current.os?.uptime || 0) / 3600)} hours`
        } : 'No current metrics'
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
      // Historical
      const avgCpu = history?.length ? (history.reduce((acc, curr) => acc + (curr.cpu?.usage || 0), 0) / history.length) : 0;
      const avgRam = history?.length ? (history.reduce((acc, curr) => acc + (curr.memory?.usagePercent || 0), 0) / history.length) : 0;

      reportData = {
        title: 'Historical Trends Summary Report',
        timestamp,
        dataPointsCount: history?.length || 0,
        aggregates: {
          averageCpuUsage: `${avgCpu.toFixed(1)}%`,
          averageMemoryUsage: `${avgRam.toFixed(1)}%`,
          monitoredPeriodSeconds: (history?.length || 0) * 2
        }
      };
    }

    setGeneratedReport(reportData);
    setHistoryReports(prev => [
      { id: Date.now().toString(), title: reportData.title, timestamp, type: reportType },
      ...prev.slice(0, 4)
    ]);
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
