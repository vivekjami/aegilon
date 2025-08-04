import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, TrendingUp, Activity, Eye, Zap } from 'lucide-react';

interface MEVAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  target: string;
  attacker: string;
  potentialLoss: string;
  riskScore: number;
  blockNumber: string;
  transactionHash: string;
  timestamp: string;
}

interface MonitoringStats {
  totalAlerts: number;
  alertsLast24h: number;
  avgRiskScore: number;
  amountSaved: string;
  highSeverityAlerts: number;
}

const MEVDashboard: React.FC = () => {
  const [alerts, setAlerts] = useState<MEVAlert[]>([]);
  const [stats, setStats] = useState<MonitoringStats>({
    totalAlerts: 0,
    alertsLast24h: 0,
    avgRiskScore: 0,
    amountSaved: '0',
    highSeverityAlerts: 0
  });
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // In a real implementation, this would connect to your WebSocket or polling service
    // For demo purposes, we'll simulate the connection
    setIsConnected(true);
    
    // Simulate some sample alerts
    const sampleAlerts: MEVAlert[] = [
      {
        id: '1',
        type: 'SANDWICH',
        severity: 'HIGH',
        target: '0x742d35Cc6634C0532925a3b8D89d5a68E4',
        attacker: '0x892d35Cc6634C0532925a3b8D89d5a68E5',
        potentialLoss: '2.5',
        riskScore: 87,
        blockNumber: '12345678',
        transactionHash: '0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        timestamp: new Date().toISOString()
      },
      {
        id: '2', 
        type: 'FRONTRUN',
        severity: 'MEDIUM',
        target: '0x542d35Cc6634C0532925a3b8D89d5a68E6',
        attacker: '0x692d35Cc6634C0532925a3b8D89d5a68E7',
        potentialLoss: '0.8',
        riskScore: 64,
        blockNumber: '12345679',
        transactionHash: '0xef123456789abcdef123456789abcdef123456789abcdef123456789abcdef12',
        timestamp: new Date(Date.now() - 60000).toISOString()
      }
    ];

    setAlerts(sampleAlerts);
    setStats({
      totalAlerts: 47,
      alertsLast24h: 23,
      avgRiskScore: 72,
      amountSaved: '15.6',
      highSeverityAlerts: 8
    });
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-red-500 bg-red-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getThreatIcon = (type: string) => {
    switch (type) {
      case 'SANDWICH': return '🥪';
      case 'FRONTRUN': return '🏃';
      case 'ARBITRAGE': return '⚖️';
      case 'LIQUIDATION': return '💧';
      default: return '⚠️';
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Shield className="text-blue-600" size={32} />
              Aegilon MEV Monitor
            </h1>
            <p className="text-gray-600 mt-2">Real-time MEV threat detection and protection</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAlerts}</p>
            </div>
            <Activity className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Last 24h</p>
              <p className="text-2xl font-bold text-gray-900">{stats.alertsLast24h}</p>
            </div>
            <TrendingUp className="text-green-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Risk Score</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgRiskScore}/100</p>
            </div>
            <Zap className="text-yellow-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Amount Saved</p>
              <p className="text-2xl font-bold text-gray-900">{stats.amountSaved} XTZ</p>
            </div>
            <Shield className="text-blue-500" size={24} />
          </div>
        </div>

        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Severity</p>
              <p className="text-2xl font-bold text-gray-900">{stats.highSeverityAlerts}</p>
            </div>
            <AlertTriangle className="text-red-500" size={24} />
          </div>
        </div>
      </div>

      {/* Real-time Alerts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Eye size={20} />
              Live MEV Alerts
            </h2>
            <span className="text-sm text-gray-500">Updated in real-time</span>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <Eye className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-500">No MEV threats detected. System is monitoring...</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="text-2xl">{getThreatIcon(alert.type)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{alert.type} Attack</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className="text-sm text-gray-500">Block #{alert.blockNumber}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Target:</span>
                          <p className="font-mono text-gray-900">{formatAddress(alert.target)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Attacker:</span>
                          <p className="font-mono text-gray-900">{formatAddress(alert.attacker)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Potential Loss:</span>
                          <p className="font-semibold text-red-600">{alert.potentialLoss} XTZ</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Risk Score:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  alert.riskScore >= 80 ? 'bg-red-500' : 
                                  alert.riskScore >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${alert.riskScore}%` }}
                              ></div>
                            </div>
                            <span className="font-medium">{alert.riskScore}/100</span>
                          </div>
                        </div>
                        
                        <div className="text-gray-500">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <span className="text-xs text-gray-500">TX: </span>
                        <span className="text-xs font-mono text-gray-700">{formatAddress(alert.transactionHash)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Status Footer */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Aegilon MEV Protection System - Monitoring Etherlink Ghostnet</p>
        <p>Sub-second detection | Real-time alerts | Automated protection</p>
      </div>
    </div>
  );
};

export default MEVDashboard;
