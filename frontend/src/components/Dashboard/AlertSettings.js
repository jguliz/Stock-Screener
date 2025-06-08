import React, { useState } from 'react';
import { Bell, TrendingUp, TrendingDown, ArrowUpDown, Clock, Target } from 'lucide-react';
import { useStock } from '../../context/StockContext';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import Input from '../UI/Input';

const AlertSettings = ({ stock, onClose }) => {
  const { setAlert } = useStock();
  
  // Alert type - 'interval' or 'target'
  const [alertType, setAlertType] = useState('interval');
  
  // Alert settings
  const [threshold, setThreshold] = useState('5');
  const [direction, setDirection] = useState('both'); // 'above', 'below', 'both'
  const [timeInterval, setTimeInterval] = useState('5'); // in minutes
  const [customPrice, setCustomPrice] = useState(stock.last_price.toFixed(2));
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Calculate the target prices based on threshold
  const calculateTargetPrices = () => {
    const price = parseFloat(customPrice);
    const thresholdPercent = parseFloat(threshold) / 100;
    
    if (isNaN(price) || isNaN(thresholdPercent)) {
      return { upper: 0, lower: 0 };
    }
    
    const upper = price * (1 + thresholdPercent);
    const lower = price * (1 - thresholdPercent);
    
    return { 
      upper: upper.toFixed(2), 
      lower: lower.toFixed(2) 
    };
  };
  
  const targets = calculateTargetPrices();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!threshold || isNaN(parseFloat(threshold)) || parseFloat(threshold) <= 0) {
      setError('Please enter a valid positive number for the threshold');
      return;
    }
    
    if (alertType === 'interval' && (!timeInterval || isNaN(parseInt(timeInterval)) || parseInt(timeInterval) <= 0)) {
      setError('Please enter a valid positive number for the time interval');
      return;
    }
    
    if (alertType === 'target' && (!customPrice || isNaN(parseFloat(customPrice)) || parseFloat(customPrice) <= 0)) {
      setError('Please enter a valid positive number for the custom price');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const alertData = {
        stockId: stock.id,
        threshold: parseFloat(threshold),
        direction,
        type: alertType,
        ...(alertType === 'interval' ? { timeInterval: parseInt(timeInterval) } : {}),
        ...(alertType === 'target' ? { basePrice: parseFloat(customPrice) } : {})
      };
      
      await setAlert(stock.id, alertData);
      setSuccess(true);
      
      // Close after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to set alert');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Set Price Alert for ${stock.symbol}`}
      size="medium"
    >
      {success ? (
        <div className="text-center py-8">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
            <Bell className="h-6 w-6 text-green-600 dark:text-green-200" />
          </div>
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">Alert Set Successfully</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            You will be notified when {stock.symbol} {alertType === 'interval' 
              ? `changes by ${threshold}% within ${timeInterval} minutes` 
              : `reaches ${direction === 'above' ? targets.upper : direction === 'below' ? targets.lower : `${targets.lower} or ${targets.upper}`}`}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="my-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Price
            </label>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              ${typeof stock.last_price === 'number' ? stock.last_price.toFixed(2) : parseFloat(stock.last_price).toFixed(2)}
              <span className={`ml-2 text-sm font-normal ${
                stock.change_percent >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {stock.change_percent >= 0 ? '+' : ''}{stock.change_percent.toFixed(2)}%
              </span>
            </div>
          </div>
          
          {/* Alert Type Selection */}
          <div className="my-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Alert Type
            </label>
            <div className="flex space-x-4 mb-4">
              <div 
                className={`flex-1 p-4 border rounded-lg cursor-pointer text-center
                  ${alertType === 'interval' 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900 dark:bg-opacity-20' 
                    : 'border-gray-300 dark:border-gray-700'}`}
                onClick={() => setAlertType('interval')}
              >
                <Clock className="h-6 w-6 mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                <div className="font-medium text-gray-900 dark:text-white">Time Interval</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Alert when price changes by a percentage within a time period</div>
              </div>
              
              <div 
                className={`flex-1 p-4 border rounded-lg cursor-pointer text-center
                  ${alertType === 'target' 
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900 dark:bg-opacity-20' 
                    : 'border-gray-300 dark:border-gray-700'}`}
                onClick={() => setAlertType('target')}
              >
                <Target className="h-6 w-6 mx-auto mb-2 text-indigo-600 dark:text-indigo-400" />
                <div className="font-medium text-gray-900 dark:text-white">Target Price</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Alert when price changes by a percentage from a custom price</div>
              </div>
            </div>
          </div>
          
          {/* Direction Selection */}
          <div className="my-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Alert Direction
            </label>
            <div className="flex space-x-2">
              <Button
                type="button"
                size="small"
                variant={direction === 'above' ? 'primary' : 'secondary'}
                onClick={() => setDirection('above')}
                icon={<TrendingUp className="h-4 w-4" />}
              >
                Price Rises
              </Button>
              <Button
                type="button"
                size="small"
                variant={direction === 'below' ? 'primary' : 'secondary'}
                onClick={() => setDirection('below')}
                icon={<TrendingDown className="h-4 w-4" />}
              >
                Price Falls
              </Button>
              <Button
                type="button"
                size="small"
                variant={direction === 'both' ? 'primary' : 'secondary'}
                onClick={() => setDirection('both')}
                icon={<ArrowUpDown className="h-4 w-4" />}
              >
                Either Direction
              </Button>
            </div>
          </div>
          
          {/* Threshold Input */}
          <Input
            id="threshold"
            name="threshold"
            label="Price Change Threshold (%)"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            type="number"
            min="0.1"
            step="0.1"
            required
          />
          
          {/* Time Interval Input - for interval alerts */}
          {alertType === 'interval' && (
            <Input
              id="timeInterval"
              name="timeInterval"
              label="Time Interval (minutes)"
              value={timeInterval}
              onChange={(e) => setTimeInterval(e.target.value)}
              type="number"
              min="1"
              step="1"
              required
            />
          )}
          
          {/* Custom Price Input - for target alerts */}
          {alertType === 'target' && (
            <>
              <Input
                id="customPrice"
                name="customPrice"
                label="Custom Price ($)"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                required
              />
              
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {direction === 'above' && (
                    <>Alert when price rises above <span className="font-medium text-gray-900 dark:text-white">${targets.upper}</span></>
                  )}
                  {direction === 'below' && (
                    <>Alert when price falls below <span className="font-medium text-gray-900 dark:text-white">${targets.lower}</span></>
                  )}
                  {direction === 'both' && (
                    <>Alert when price rises above <span className="font-medium text-gray-900 dark:text-white">${targets.upper}</span> or falls below <span className="font-medium text-gray-900 dark:text-white">${targets.lower}</span></>
                  )}
                </p>
              </div>
            </>
          )}
          
          {/* Error message if any */}
          {error && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          
          <div className="mt-8 flex justify-end space-x-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              icon={<Bell className="h-4 w-4" />}
            >
              {loading ? 'Setting Alert...' : 'Set Alert'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default AlertSettings;