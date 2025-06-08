// client/src/components/BackfillManager.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from './ui/table';
import { Progress } from './ui/progress';
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { formatDistanceToNow } from 'date-fns';

// API Helper for Backfill Operations
const backfillApi = {
  triggerBackfill: async (options = {}) => {
    try {
      const response = await axios.post('/api/backfill/trigger', options);
      return response.data;
    } catch (error) {
      console.error('Error triggering backfill:', error);
      throw error;
    }
  },
  
  getBackfillStatus: async (jobId) => {
    try {
      const response = await axios.get(`/api/backfill/status/${jobId}`);
      return response.data.status;
    } catch (error) {
      console.error('Error fetching backfill status:', error);
      throw error;
    }
  },
  
  backfillStocks: async (symbols, days = 7) => {
    try {
      const response = await axios.post('/api/backfill/stocks', { symbols, days });
      return response.data;
    } catch (error) {
      console.error('Error backfilling stocks:', error);
      throw error;
    }
  }
};

// BackfillManager Component
const BackfillManager = ({ activeSymbols = [], onComplete }) => {
  const [jobs, setJobs] = useState([]);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Custom backfill form state
  const [customBackfill, setCustomBackfill] = useState({
    symbols: [],
    days: 7,
    mode: 'auto' // 'auto' or 'custom'
  });
  
  // Poll for status updates when we have an active job
  useEffect(() => {
    let intervalId;
    
    if (currentJobId) {
      intervalId = setInterval(async () => {
        try {
          const status = await backfillApi.getBackfillStatus(currentJobId);
          
          // Update jobs list with current status
          setJobs(prevJobs => {
            const updatedJobs = [...prevJobs];
            const jobIndex = updatedJobs.findIndex(job => job.id === currentJobId);
            
            if (jobIndex !== -1) {
              updatedJobs[jobIndex] = { ...updatedJobs[jobIndex], ...status };
            } else {
              updatedJobs.unshift(status);
            }
            
            return updatedJobs;
          });
          
          // If job is complete, clear the interval and call onComplete callback
          if (status.completed) {
            clearInterval(intervalId);
            setCurrentJobId(null);
            
            if (status.status === 'completed') {
              setSuccess(`Backfill completed successfully: ${status.processedPeriods} periods filled`);
              if (onComplete) onComplete(status);
            } else if (status.status === 'failed') {
              setError(`Backfill failed: ${status.error}`);
            }
          }
        } catch (error) {
          console.error('Error polling job status:', error);
          setError('Failed to get job status update');
        }
      }, 3000); // Poll every 3 seconds
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [currentJobId, onComplete]);
  
  // Start an automatic backfill (detect and fill gaps)
  const startAutoBackfill = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const result = await backfillApi.triggerBackfill();
      setCurrentJobId(result.jobId);
      
      // Add job to the jobs list
      setJobs(prevJobs => [{
        id: result.jobId,
        startedAt: new Date().toISOString(),
        status: 'started',
        progress: 0,
        type: 'auto',
        message: 'Finding and filling gaps automatically'
      }, ...prevJobs]);
      
      setSuccess('Backfill job initiated');
    } catch (error) {
      setError('Failed to start backfill: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  // Start a custom backfill for specific symbols
  const startCustomBackfill = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      // Use selected symbols or fall back to all active symbols
      const symbols = customBackfill.symbols.length > 0 
        ? customBackfill.symbols 
        : activeSymbols;
      
      if (!symbols || symbols.length === 0) {
        setError('No symbols selected for backfill');
        setLoading(false);
        return;
      }
      
      // Calculate dates based on days selection
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - customBackfill.days);
      
      const result = await backfillApi.triggerBackfill({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        symbols,
        force: true
      });
      
      setCurrentJobId(result.jobId);
      
      // Add job to the jobs list
      setJobs(prevJobs => [{
        id: result.jobId,
        startedAt: new Date().toISOString(),
        status: 'started',
        progress: 0,
        type: 'custom',
        symbols,
        days: customBackfill.days,
        message: `Custom backfill for ${symbols.length} symbols over ${customBackfill.days} days`
      }, ...prevJobs]);
      
      setSuccess('Custom backfill job initiated');
    } catch (error) {
      setError('Failed to start custom backfill: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  // Handle form changes for custom backfill
  const handleCustomBackfillChange = (field, value) => {
    setCustomBackfill(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return timestamp;
    }
  };
  
  // Render the component
  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Data Backfill Manager</CardTitle>
      </CardHeader>
      
      <CardContent>
        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" className="mb-4">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
        
        {/* Backfill Controls */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={startAutoBackfill} 
              disabled={loading || !!currentJobId}
              className="mr-2"
            >
              {loading ? 'Starting...' : 'Auto-Detect & Fill Gaps'}
            </Button>
            
            <Select
              value={customBackfill.mode}
              onValueChange={(value) => handleCustomBackfillChange('mode', value)}
              disabled={loading || !!currentJobId}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Backfill Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Custom Backfill Options */}
          {customBackfill.mode === 'custom' && (
            <div className="bg-gray-50 p-4 rounded-md space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="days">Days to Backfill</Label>
                  <Select
                    value={customBackfill.days.toString()}
                    onValueChange={(value) => handleCustomBackfillChange('days', parseInt(value))}
                    disabled={loading || !!currentJobId}
                  >
                    <SelectTrigger id="days">
                      <SelectValue placeholder="Select days" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Day</SelectItem>
                      <SelectItem value="3">3 Days</SelectItem>
                      <SelectItem value="7">1 Week</SelectItem>
                      <SelectItem value="14">2 Weeks</SelectItem>
                      <SelectItem value="30">1 Month</SelectItem>
                      <SelectItem value="90">3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="symbols">Symbols</Label>
                  <Select
                    value={customBackfill.symbols.length === 0 ? 'all' : 'custom'}
                    onValueChange={(value) => {
                      if (value === 'all') {
                        handleCustomBackfillChange('symbols', []);
                      }
                    }}
                    disabled={loading || !!currentJobId}
                  >
                    <SelectTrigger id="symbols">
                      <SelectValue placeholder="Select symbols" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Active Symbols</SelectItem>
                      <SelectItem value="custom">Select Symbols</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <Button 
                onClick={startCustomBackfill} 
                disabled={loading || !!currentJobId}
                className="mt-2"
              >
                Start Custom Backfill
              </Button>
            </div>
          )}
          
          {/* Current Job Status */}
          {currentJobId && jobs.length > 0 && (
            <div className="mt-6 border rounded-md p-4">
              <h3 className="font-medium text-lg mb-2">Current Job Status</h3>
              
              {jobs.map(job => {
                if (job.id === currentJobId) {
                  return (
                    <div key={job.id} className="space-y-2">
                      <div className="flex justify-between">
                        <span>Status: <strong>{job.status}</strong></span>
                        <span>Started: {formatTimestamp(job.startedAt)}</span>
                      </div>
                      
                      <Progress value={job.progress || 0} className="h-2" />
                      
                      <div className="text-sm text-gray-600">
                        {job.message || job.status === 'identifying_gaps' 
                          ? 'Analyzing database for gaps in price history...'
                          : job.status === 'processing'
                          ? `Processing: ${job.processedPeriods || 0}/${job.totalPeriods || 0} periods`
                          : 'Working on backfill operation...'}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          )}
        </div>
        
        {/* Recent Jobs */}
        {jobs.length > 0 && (
          <div className="mt-6">
            <h3 className="font-medium text-lg mb-2">Recent Jobs</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.slice(0, 5).map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.id.substring(0, 8)}...</TableCell>
                    <TableCell>{job.type || 'auto'}</TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                        job.status === 'completed' ? 'bg-green-100 text-green-800' :
                        job.status === 'failed' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {job.status}
                      </span>
                    </TableCell>
                    <TableCell>{job.progress || 0}%</TableCell>
                    <TableCell>{formatTimestamp(job.startedAt)}</TableCell>
                    <TableCell>{job.completedAt ? formatTimestamp(job.completedAt) : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="border-t bg-gray-50 px-6 py-3">
        <p className="text-sm text-gray-600">
          Backfilling fills gaps in your price history data, ensuring continuous charts even when the server was offline.
        </p>
      </CardFooter>
    </Card>
  );
};