import React, { useState, useEffect } from 'react';
import { createTheme, ThemeProvider } from '@material-ui/core/styles';
import { Card, CardContent, CardHeader, Select, MenuItem, TextField, Button, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@material-ui/core';
import { ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const theme = createTheme();

const parseCSV = (csvString) => {
  const lines = csvString.split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return headers.reduce((obj, header, index) => {
      obj[header.trim()] = values[index] ? values[index].trim() : '';
      return obj;
    }, {});
  });
};

const calculateProfitLoss = (trades) => {
  const profitLoss = {};
  trades.forEach(trade => {
    if (!trade.Instrument || !trade.Description || !trade["Trans Code"]) return;
    
    const [, expiry, type, strike] = trade.Description.split(' ');
    if (!expiry || !type || !strike) return;
    
    const key = `${trade.Instrument}_${expiry}_${type}_${strike}`;
    if (!profitLoss[key]) {
      profitLoss[key] = { 
        instrument: trade.Instrument,
        expiry,
        type,
        strike,
        buyQuantity: 0,
        sellQuantity: 0,
        buyAmount: 0,
        sellAmount: 0,
        pl: 0,
        openDate: null,
        closeDate: null
      };
    }
    
    const quantity = parseFloat(trade.Quantity) || 0;
    const amount = Math.abs(parseFloat(trade.Amount.replace('$', '')) || 0);
    const date = new Date(trade["Activity Date"]);
    
    if (trade["Trans Code"] === "BTO") {
      profitLoss[key].buyQuantity += quantity;
      profitLoss[key].buyAmount += amount;
      if (!profitLoss[key].openDate || date < profitLoss[key].openDate) {
        profitLoss[key].openDate = date;
      }
    } else if (trade["Trans Code"] === "STC") {
      profitLoss[key].sellQuantity += quantity;
      profitLoss[key].sellAmount += amount;
      if (!profitLoss[key].closeDate || date > profitLoss[key].closeDate) {
        profitLoss[key].closeDate = date;
      }
    }
    
    profitLoss[key].pl = profitLoss[key].sellAmount - profitLoss[key].buyAmount;
  });
  return Object.values(profitLoss).filter(trade => trade.closeDate !== null);
};

const OptionsTradingDashboard = () => {
  const [csvData, setCsvData] = useState([]);
  const [profitLossData, setProfitLossData] = useState([]);
  const [selectedInstrument, setSelectedInstrument] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [file, setFile] = useState(null);

  const [timeSeriesData, setTimeSeriesData] = useState([]);

  const handleFileUpload = (event) => {
    setFile(event.target.files[0]);
  };

  const handleFileSubmit = () => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvContent = e.target.result;
        const parsedData = parseCSV(csvContent);
        setCsvData(parsedData);
        const plData = calculateProfitLoss(parsedData);
        setProfitLossData(plData);
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    if (csvData.length > 0) {
      const sortedData = csvData.sort((a, b) => new Date(a["Activity Date"]) - new Date(b["Activity Date"]));
      let cumulativePL = 0;
      const timeSeriesData = sortedData.map(trade => {
        const amount = parseFloat(trade.Amount.replace('$', '')) || 0;
        cumulativePL += amount;
        return {
          date: trade["Activity Date"],
          pl: cumulativePL
        };
      });
      setTimeSeriesData(timeSeriesData);
    }
  }, [csvData]);

  const instruments = ['All', ...new Set(csvData.map(row => row.Instrument))];

  const filteredData = csvData.filter(row => 
    (selectedInstrument === 'All' || row.Instrument === selectedInstrument) &&
    (dateRange.start === '' || row["Activity Date"] >= dateRange.start) &&
    (dateRange.end === '' || row["Activity Date"] <= dateRange.end)
  );

  const aggregatedPL = profitLossData.reduce((acc, curr) => acc + curr.pl, 0);
  const winRate = (profitLossData.filter(trade => trade.pl > 0).length / profitLossData.length) * 100;

  const topProfitableTrades = profitLossData
    .filter(trade => trade.pl > 0)
    .sort((a, b) => b.pl - a.pl)
    .slice(0, 5);

  const topLossMakingTrades = profitLossData
    .filter(trade => trade.pl < 0)
    .sort((a, b) => a.pl - b.pl)
    .slice(0, 5);

  const plByInstrument = profitLossData.reduce((acc, trade) => {
    if (!acc[trade.instrument]) acc[trade.instrument] = 0;
    acc[trade.instrument] += trade.pl;
    return acc;
  }, {});

  const plByType = profitLossData.reduce((acc, trade) => {
    if (!acc[trade.type]) acc[trade.type] = 0;
    acc[trade.type] += trade.pl;
    return acc;
  }, {});

  const holdingPeriodAnalysis = profitLossData.reduce((acc, trade) => {
    const holdingPeriod = (trade.closeDate - trade.openDate) / (1000 * 60 * 60 * 24); // in days
    if (trade.pl > 0) {
      acc.profitable.push(holdingPeriod);
    } else {
      acc.unprofitable.push(holdingPeriod);
    }
    return acc;
  }, { profitable: [], unprofitable: [] });

  const avgProfitableHoldingPeriod = holdingPeriodAnalysis.profitable.reduce((a, b) => a + b, 0) / holdingPeriodAnalysis.profitable.length;
  const avgUnprofitableHoldingPeriod = holdingPeriodAnalysis.unprofitable.reduce((a, b) => a + b, 0) / holdingPeriodAnalysis.unprofitable.length;

  return (
    <ThemeProvider theme={theme}>
      <div style={{ padding: '1rem' }}>
        <Typography variant="h4" gutterBottom>Options Trading Analysis Dashboard</Typography>
        
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            style={{ marginRight: '1rem' }}
          />
          <Button variant="contained" color="primary" onClick={handleFileSubmit}>
            Upload CSV
          </Button>
        </div>

        {csvData.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
              <Card>
                <CardHeader title="Total Profit/Loss" />
                <CardContent>
                  <Typography variant="h5" style={{ color: aggregatedPL >= 0 ? 'green' : 'red' }}>
                    ${aggregatedPL.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Total Trades" />
                <CardContent>
                  <Typography variant="h5">{profitLossData.length}</Typography>
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Win Rate" />
                <CardContent>
                  <Typography variant="h5">{winRate.toFixed(2)}%</Typography>
                </CardContent>
              </Card>
            </div>
            
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Card>
                <CardHeader title="Profit/Loss by Instrument" />
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(plByInstrument).map(([instrument, pl]) => ({ instrument, pl }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="instrument" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="pl" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Profit/Loss by Option Type" />
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(plByType).map(([type, pl]) => ({ type, pl }))}
                        dataKey="pl"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        label
                      >
                        {Object.entries(plByType).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry[0] === 'Call' ? '#8884d8' : '#82ca9d'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card style={{ marginTop: '1rem' }}>
              <CardHeader title="Cumulative Profit/Loss Over Time" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="pl" stroke="#8884d8" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {topProfitableTrades.length > 0 && (
              <Card style={{ marginTop: '1rem' }}>
                <CardHeader title="Top Profitable Trades" />
                <CardContent>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Instrument</th>
                        <th>Type</th>
                        <th>Expiry</th>
                        <th>Strike</th>
                        <th>Profit/Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProfitableTrades.map((trade, index) => (
                        <tr key={index}>
                          <td>{trade.instrument}</td>
                          <td>{trade.type}</td>
                          <td>{trade.expiry}</td>
                          <td>{trade.strike}</td>
                          <td style={{ color: 'green' }}>${trade.pl.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            {topLossMakingTrades.length > 0 && (
              <Card style={{ marginTop: '1rem' }}>
                <CardHeader title="Top Loss-Making Trades" />
                <CardContent>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Instrument</th>
                        <th>Type</th>
                        <th>Expiry</th>
                        <th>Strike</th>
                        <th>Profit/Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topLossMakingTrades.map((trade, index) => (
                        <tr key={index}>
                          <td>{trade.instrument}</td>
                          <td>{trade.type}</td>
                          <td>{trade.expiry}</td>
                          <td>{trade.strike}</td>
                          <td style={{ color: 'red' }}>${trade.pl.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            <Card style={{ marginTop: '1rem' }}>
              <CardHeader title="Holding Period Analysis" />
              <CardContent>
                <Typography>Average Holding Period for Profitable Trades: {avgProfitableHoldingPeriod.toFixed(2)} days</Typography>
                <Typography>Average Holding Period for Unprofitable Trades: {avgUnprofitableHoldingPeriod.toFixed(2)} days</Typography>
              </CardContent>
            </Card>

            <Card style={{ marginTop: '1rem' }}>
              <CardHeader title="All Trades" />
              <CardContent>
                <TableContainer component={Paper} style={{ maxHeight: 400 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Instrument</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Transaction</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredData.map((trade, index) => (
                        <TableRow key={index}>
                          <TableCell>{trade["Activity Date"]}</TableCell>
                          <TableCell>{trade.Instrument}</TableCell>
                          <TableCell>{trade.Description}</TableCell>
                          <TableCell>{trade["Trans Code"]}</TableCell>
                          <TableCell>{trade.Quantity}</TableCell>
                          <TableCell>${isNaN(parseFloat(trade.Price)) ? '0.00' : parseFloat(trade.Price).toFixed(2)}</TableCell>
                          <TableCell>${isNaN(parseFloat(trade.Amount)) ? '0.00' : Math.abs(parseFloat(trade.Amount)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </>
        ) : (
          <Typography>Please upload a CSV file to view the dashboard.</Typography>
        )}
      </div>
    </ThemeProvider>
  );
};

export default OptionsTradingDashboard;