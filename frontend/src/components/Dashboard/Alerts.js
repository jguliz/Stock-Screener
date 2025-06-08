import React from 'react';
import { Bell, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useStock } from '../../context/StockContext';
import Header from '../Common/Header';
import Footer from '../Common/Footer';
import Card from '../UI/Card';
import Button from '../UI/Button';

const Alerts = () => {
  const { alerts, deleteAlert } = useStock();

  const getAlertIcon = (direction) => {
    switch (direction) {
      case 'above': return <TrendingUp className="text-green-500 h-5 w-5" />;
      case 'below': return <TrendingDown className="text-red-500 h-5 w-5" />;
      default: return <Bell className="text-indigo-500 h-5 w-5" />;
    }
  };

  const formatAlertDescription = (alert) => {
    const typeDescriptions = {
      'interval': `Alert when price changes by ${alert.threshold}% within ${alert.timeInterval} minutes`,
      'target': `Alert when price ${
        alert.direction === 'above' ? 'rises above' : 
        alert.direction === 'below' ? 'falls below' : 
        'changes'
      } $${alert.basePrice}`
    };

    return typeDescriptions[alert.type] || 'Custom Alert';
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 dark:bg-dark-300">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Bell className="mr-3 h-6 w-6 text-indigo-500" />
            My Price Alerts
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Track and manage your stock price alerts
          </p>
        </div>

        {alerts.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <Bell className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No Active Alerts
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Set up alerts to get notified about stock price changes
              </p>
              <Button variant="primary">
                Create First Alert
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {alerts.map((alert) => (
              <Card 
                key={alert.id} 
                className="hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center">
                    {getAlertIcon(alert.direction)}
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white ml-3">
                      {alert.stock.symbol}
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    size="small"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => deleteAlert(alert.id)}
                  >
                    Delete
                  </Button>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatAlertDescription(alert)}
                  </p>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Current Price</span>
                    <span className={`font-medium ${
                      alert.stock.change_percent >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      ${alert.stock.last_price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                    <span className={`font-medium ${
                      alert.status === 'active' 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {alert.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
      
      <Footer />
    </div>
  );
};

export default Alerts;