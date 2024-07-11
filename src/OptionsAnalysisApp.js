import React, { useState, useEffect } from 'react';
import { createTheme, ThemeProvider } from '@material-ui/core/styles';
import { Card, CardContent, CardHeader, Select, MenuItem, TextField, Button, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@material-ui/core';
import { ScatterChart, Scatter, LineChart, Line, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

const theme = createTheme();

// const parseCSV = (csvString) => {
//   const lines = csvString.split('\n');
//   const headers = lines[0].split(',');
//   return lines.slice(1).map(line => {
//     const values = line.split(',');
//     return headers.reduce((obj, header, index) => {
//       obj[header.trim()] = values[index] ? values[index].trim() : '';
//       return obj;
//     }, {});
//   });
// };

const parseCSV = (csvString) => {
  const lines = csvString.split('\n');
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return headers.reduce((obj, header, index) => {
      let value = values[index];
      if (header === 'Amount') {
        value = value.replace(/"/g, '').replace(/,/g, '');
      }
      obj[header.trim()] = value ? value.trim() : '';
      return obj;
    }, {});
  });
};


function parseDescription(description) {
  const parts = description.split(' ');
  let instrument, desc = '', expiry, type, strike;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (i === 0) {
      instrument = part;
    } else if (part.includes('/')) {
      expiry = part;
    } else if (part === 'Call' || part === 'Put') {
      type = part;
    } else if (part.startsWith('$')) {
      strike = part.replace('$', '');
    } else {
      desc += part + ' ';
    }
  }

  return { instrument, expiry, type, strike };
}

const calculateProfitLoss = (trades) => {
  const profitLoss = {};
  trades.forEach(trade => {
    if (!trade.Instrument || !trade.Description || !trade["Trans Code"]) return;
        
    // // const [, expiry, type, strike] = trade.Description.split(' ');
    // const [ , expiry, type, strike ] = parseDescription(trade.Description);

    const parts = trade.Description.split(' ');
    let instrument, desc = '', expiry, type, strike;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (i === 0) {
        // instrument = part;
      } else if (part.includes('/')) {
        expiry = part;
      } else if (part === 'Call' || part === 'Put') {
        type = part;
      } else if (part.startsWith('$')) {
        strike = part.replace('$', '');
      } else {
        desc += part + ' ';
      }
    }



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
        closeDate: null, 
        expiryDate: null, 
        sign: 1,
        revenue: 0,
      };
    }
    
    const quantity = parseFloat(trade.Quantity) || 0;
    let amount = trade.Amount ? trade.Amount.replace(/,/g, '').replace(/[^\d.-]/g, '') : '0';
    amount = parseFloat(amount);
    // console.log(trade.Instrument ,amount, trade.Amount)
    
    // if (trade.Amount.startsWith('(')) {
    //   amount = -parseFloat(amount);
    // } else {
    //   amount = parseFloat(amount);
    // }

    // let trade_price = parseFloat(trade.Price.replace('$', ''))

    // const strikePrice = parseFloat(strike);
    // const sellPrice = parseFloat(trade_price) * 100;
    // const totalCost = sellPrice * quantity;
    // const totalStrike = strikePrice * quantity;

    // const strikePrice = parseFloat(strike);
    // const sellPrice = parseFloat(amount);
    // const totalCost = sellPrice;
    // const totalStrike = strikePrice * quantity;

    const totalStrike = amount
    const totalCost = amount


    // if (isNaN(totalCost) || isNaN(totalStrike)) {
    //   console.error(`Invalid calculation for trade: ${trade.Description} ${totalCost} ${totalStrike} ${strikePrice} ${sellPrice} and text: ${trade.Amount} ${trade.Price}`);
    //   return;
    // }

    const date = new Date(trade["Activity Date"]);
    
    // if (trade["Trans Code"] === "BTO") {
    //   profitLoss[key].buyQuantity += quantity;
    //   profitLoss[key].buyAmount += amount;
    //   if (!profitLoss[key].openDate || date < profitLoss[key].openDate) {
    //     profitLoss[key].openDate = date;
    //   }
    // } else if (trade["Trans Code"] === "STC") {
    //   profitLoss[key].sellQuantity += quantity;
    //   profitLoss[key].sellAmount += amount;
    //   if (!profitLoss[key].closeDate || date > profitLoss[key].closeDate) {
    //     profitLoss[key].closeDate = date;
    //   }
    // }
    
    // the settle date is completely different than the process date, and cannot be used for computing profit, its just when the amount is issued/committed
    // wait for the STC after BTO transactions to compute the profit otherwise it will be negative .
    // compute profit for BTO and STC transactions:
    if (trade["Trans Code"] === "BTO") {
      profitLoss[key].buyQuantity += quantity;
      profitLoss[key].buyAmount += totalStrike;
      if (!profitLoss[key].openDate || date < profitLoss[key].openDate) {
        profitLoss[key].openDate = date;
      }
    } else if (trade["Trans Code"] === "STC") {
      profitLoss[key].sellQuantity += quantity;
      profitLoss[key].sellAmount += totalCost;
      if (!profitLoss[key].closeDate || date > profitLoss[key].closeDate) {
        profitLoss[key].closeDate = date;
      }
    }

    // comptue loss for the Expiration options
    if (trade["Trans Code"] === "OEXP" || desc.toLowerCase().indexOf("exp") == 1) {
        profitLoss[key].sellAmount = 0;
        profitLoss[key].sellQuantity = profitLoss[key].buyQuantity;
        profitLoss[key].pl = profitLoss[key].sellAmount - profitLoss[key].buyAmount;
        profitLoss[key].expiryDate = new Date(trade["Process Date"]);
      }


    if (isNaN(profitLoss[key].sellAmount) || isNaN(profitLoss[key].buyAmount)) {
      console.error(`Invalid profit/loss calculation for trade: ${trade.Description}`);
      profitLoss[key].pl = 0;
    } else {
      profitLoss[key].pl = profitLoss[key].sellAmount - profitLoss[key].buyAmount;
    }

    
    profitLoss[key].revenue = profitLoss[key].sellAmount


    if(profitLoss[key].pl > 0){
      // console.error(`type was ${type}`);
      profitLoss[key].type = type;
      // console.error(`type is ${type}`);
    }

  });
  console.log(profitLoss)
  return Object.values(profitLoss); // .filter(trade => trade.closeDate !== null)
};



const OptionsTradingDashboard = () => {
  const [csvData, setCsvData] = useState([]);
  const [profitLossData, setProfitLossData] = useState([]);
  const [instrumentSort, setInstrumentSort] = useState('none');
  const [revenueSort, setRevenueSort] = useState('none');
  const [transactionSort, setTransactionSort] = useState('none');
  const [selectedInstrument, setSelectedInstrument] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [file, setFile] = useState(null);
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [sliceStart, setSliceStart] = useState(0);
  const [sliceEnd, setSliceEnd] = useState(csvData.length);
  const [notes, setNotes] = useState('');

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
        setSliceStart(0);
        setSliceEnd(parsedData.length);
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    if (csvData.length > 0) {
      const slicedData = csvData.slice(sliceStart, sliceEnd);
      const plData = calculateProfitLoss(slicedData);
      setProfitLossData(plData);

      const sortedData = slicedData.sort((a, b) => new Date(a["Activity Date"]) - new Date(b["Activity Date"]));
      let cumulativePL = 0;
      const timeSeriesData = sortedData.map(trade => {
        let amount = 0;
        if (trade.Amount) {
          amount = parseFloat(trade.Amount.replace(/[^\d.-]/g, ''));
          if (trade.Amount.startsWith('(')) {
            amount = -amount;
          }
        }
        cumulativePL += amount;
        return {
          date: trade["Activity Date"],
          pl: cumulativePL
        };
      });
      setTimeSeriesData(timeSeriesData);

      const savedNotes = localStorage.getItem('tradingNotes');
      if (savedNotes) {
        setNotes(savedNotes);
      }

    }
  }, [csvData, sliceStart, sliceEnd]);

useEffect(() => {
  localStorage.setItem('tradingNotes', notes);
}, [notes]);


  const slicedData = csvData.slice(sliceStart, sliceEnd);
  const instruments = ['All', ...new Set(slicedData.map(row => row.Instrument))];

  const filteredData = slicedData.filter(row => 
    (selectedInstrument === 'All' || row.Instrument === selectedInstrument) &&
    (dateRange.start === '' || row["Activity Date"] >= dateRange.start) &&
    (dateRange.end === '' || row["Activity Date"] <= dateRange.end)
  );

  const aggregatedPL = profitLossData.reduce((acc, curr) => acc + curr.pl, 0);
  const totalProfit = profitLossData.reduce((acc, curr) => curr.pl > 0 ? acc + curr.pl : acc, 0);
  const totalLoss = profitLossData.reduce((acc, curr) => curr.pl < 0 ? acc - curr.pl : acc, 0);
  const winRate = (profitLossData.filter(trade => trade.pl > 0).length / profitLossData.length) * 100;

  const plByInstrument = profitLossData.reduce((acc, trade) => {
    if (!acc[trade.instrument]) acc[trade.instrument] = 0;
    acc[trade.instrument] += trade.pl;
    return acc;
  }, {});

  const plByRevenue = profitLossData.reduce((acc, trade) => {
    if (!acc[trade.instrument]) acc[trade.instrument] = 0;
    acc[trade.instrument] += trade.revenue;
    return acc;
  }, {});

  const sortedPlByInstrument = Object.entries(plByInstrument)
    .filter(([instrument, pl]) => pl !== 0)
    .map(([instrument, pl]) => ({ instrument, pl }));

  const sortedPlByRevenue = Object.entries(plByRevenue)
    .filter(([instrument, revenue]) => revenue !== 0)
    .map(([instrument, revenue]) => ({ instrument, revenue }));

  const transactionData = slicedData.map(trade => {
    let amount = trade.Amount.replace(/[^\d.-]/g, '');
    if (trade.Amount.startsWith('(')) {
      amount = -parseFloat(amount);
    } else {
      amount = parseFloat(amount);
    }
    return {
      label: `${trade["Activity Date"]} - ${trade.Instrument}`,
      date: trade["Activity Date"],
      amount: amount
    };
  });

  const topProfitableTrades = profitLossData
    .filter(trade => trade.pl > 0)
    .sort((a, b) => b.pl - a.pl)
    .slice(0, 5);

  const topLossMakingTrades = profitLossData
    .filter(trade => trade.pl < 0)
    .sort((a, b) => a.pl - b.pl)
    .slice(0, 5);

  const plByType = profitLossData.reduce((acc, trade) => {
    if (!acc[trade.type]) acc[trade.type] = 0;
    acc[trade.type] += Math.abs(trade.pl);
    trade.sign = parseInt(trade.pl >=0);
    return acc;
  }, {});

  Object.keys(plByType).forEach((type) => {
  plByType[type] = {
    pl: plByType[type],
    sign: profitLossData.find((trade) => trade.type === type).pl >= 0 ? 1 : -1,
  };
});



  const holdingPeriodAnalysis = profitLossData.reduce((acc, trade) => {
    if (!trade || !trade.openDate) return acc; // !trade.closeDate 
    if (trade.closeDate <= 0 || trade.openDate <= 0) return acc;

    let holdingPeriod = 0;
    if (trade.expiryDate){
      holdingPeriod = (trade.expiryDate - trade.openDate) / (1000 * 60 * 60 * 24); // in days
    }
    else{
      holdingPeriod = (trade.closeDate - trade.openDate) / (1000 * 60 * 60 * 24); // in days
    }

    if (holdingPeriod <= 0) return acc;

    if (trade.pl > 0) {
      acc.profitable.push(holdingPeriod);
    } else {
      acc.unprofitable.push(holdingPeriod);
    }
    return acc;
  }, { profitable: [], unprofitable: [] });

  const avgProfitableHoldingPeriod = holdingPeriodAnalysis.profitable.length > 0 
    ? holdingPeriodAnalysis.profitable.reduce((a, b) => a + b, 0) / holdingPeriodAnalysis.profitable.length
    : 0;

  const avgUnprofitableHoldingPeriod = holdingPeriodAnalysis.unprofitable.length > 0
    ? holdingPeriodAnalysis.unprofitable.reduce((a, b) => a + b, 0) / holdingPeriodAnalysis.unprofitable.length
    : 0;

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
            <div style={{ marginBottom: '1rem' }}>
                <Typography>Start Row: {sliceStart}</Typography>
                <input
                  type="range"
                  min="0"
                  max={csvData.length - 1}
                  value={sliceStart}
                  onChange={(e) => {
                    const newStart = parseInt(e.target.value);
                    setSliceStart(newStart);
                    if (newStart >= sliceEnd) {
                      setSliceEnd(newStart + 1);
                    }
                  }}
                />
                <Typography>End Row: {sliceEnd}</Typography>
                <input
                  type="range"
                  min={sliceStart + 1}
                  max={csvData.length}
                  value={sliceEnd}
                  onChange={(e) => setSliceEnd(parseInt(e.target.value))}
                />
                <Typography>Showing date range: {csvData[sliceStart] && csvData[sliceStart]["Activity Date"]} to {csvData[sliceEnd - 1] && csvData[sliceEnd - 1]["Activity Date"]}</Typography>
                <Typography>Showing rows {sliceStart} to {sliceEnd} of {csvData.length}</Typography>
              </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <Card>
              <CardHeader title="Total Profit/Loss" />
              <CardContent>
                <Typography variant="h5" style={{ color: aggregatedPL >= 0 ? 'green' : 'red' }}>
                  ${aggregatedPL.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Total Profit" />
              <CardContent>
                <Typography variant="h5" style={{ color: 'green' }}>
                  ${totalProfit.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Total Loss" />
              <CardContent>
                <Typography variant="h5" style={{ color: 'red' }}>
                  ${totalLoss.toFixed(2)}
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
            
            <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '1rem' }}>
              <Card>
                <CardHeader title="Profit/Loss by Instrument" />
                <CardContent>
                  <Typography variant="body1">Sort by Profit/Loss:</Typography>
                  <Select
                    value={instrumentSort}
                    onChange={(e) => setInstrumentSort(e.target.value)}
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                    <MenuItem value="none">None</MenuItem>
                  </Select>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={instrumentSort === 'asc' ? sortedPlByInstrument.sort((a, b) => a.pl - b.pl) :
                      instrumentSort === 'desc' ? sortedPlByInstrument.sort((a, b) => b.pl - a.pl) :
                      sortedPlByInstrument}>
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
                        data={Object.entries(plByType).map(([type, pl]) => ({ type, pl: pl.pl, sign: pl.sign }))}
                        dataKey="pl"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        label={(entry) => `${entry.type}: ${entry.sign === 1 ? '+' : '-'}${Math.abs(entry.pl)}`}
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

            <Card>
                <CardHeader title="Revenue by Instrument" />
                <CardContent>
                  <Typography variant="body1">Sort by Revenue: </Typography>
                  <Select
                    value={revenueSort}
                    onChange={(e) => setRevenueSort(e.target.value)}
                  >
                    <MenuItem value="asc">Ascending</MenuItem>
                    <MenuItem value="desc">Descending</MenuItem>
                    <MenuItem value="none">None</MenuItem>
                  </Select>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueSort === 'asc' ? sortedPlByRevenue.sort((a, b) => a.pl - b.pl) :
                      revenueSort === 'desc' ? sortedPlByRevenue.sort((a, b) => b.pl - a.pl) :
                      sortedPlByRevenue}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="instrument" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

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

            <Card style={{ marginTop: '1rem' }}>
              <CardHeader title="Profit/Loss by Transaction" />
              <CardContent>
                <Typography variant="body1">Sort by Profit/Loss:</Typography>
                <Select
                  value={transactionSort}
                  onChange={(e) => setTransactionSort(e.target.value)}
                >
                  <MenuItem value="asc">Ascending</MenuItem>
                  <MenuItem value="desc">Descending</MenuItem>
                  <MenuItem value="none">None</MenuItem>
                </Select>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={transactionSort === 'asc' ? transactionData.sort((a, b) => a.amount - b.amount) :
                    transactionSort === 'desc' ? transactionData.sort((a, b) => b.amount - a.amount) :
                    transactionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value, name, props) => [value, props.payload.label]} />
                    <Legend />
                    <Bar dataKey="amount" fill="#8884d8" />
                  </BarChart>
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

            <Card>
              <CardHeader title="Holding Period Analysis" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={profitLossData.filter(trade =>  trade.openDate).map(trade => { // trade.closeDate &&

                   let holdingPeriod = 0;
                    if (trade.expiryDate){
                      holdingPeriod = (trade.expiryDate - trade.openDate) / (1000 * 60 * 60 * 24); // in days
                    }
                    else{
                      holdingPeriod = (trade.closeDate - trade.openDate) / (1000 * 60 * 60 * 24); // in days
                    }
                    if (holdingPeriod <= 0) {
                      // Handle edge case where holding period is not positive
                      return null;
                    }
                    return {
                      instrument: trade.instrument,
                      holdingPeriod: holdingPeriod
                    };
                  }).filter(Boolean)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="instrument" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="holdingPeriod" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>

                <Typography>Average Holding Period for Profitable Trades: {avgProfitableHoldingPeriod.toFixed(2)} days</Typography>
                <Typography>Average Holding Period for Unprofitable Trades: {avgUnprofitableHoldingPeriod.toFixed(2)} days</Typography>
              </CardContent>
            </Card>


            <Card style={{ marginTop: '1rem' }}>
            <CardHeader title="Trading Notes" />
            <CardContent>
              <TextField
                multiline
                rows={35}
                variant="outlined"
                fullWidth
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={`Upload your trading data:
- Use the file upload feature to import your CSV file containing your trading history.
- Once uploaded, the dashboard will process your data and display various analytics.

Analyze Profit/Loss by Option Type:
- Look at the "Profit/Loss by Option Type" pie chart. This will show you the overall performance of your call and put options.
- If one type (calls or puts) is significantly outperforming the other, you might want to focus more on the successful type.

Examine Top Profitable and Loss-Making Trades:
- The dashboard displays tables for "Top Profitable Trades" and "Top Loss-Making Trades".
- Pay attention to the patterns in these tables. Look for common characteristics among your profitable trades (e.g., specific instruments, expiry dates, or strike prices) and try to avoid patterns seen in loss-making trades.

Analyze Profit/Loss by Instrument:
- The "Profit/Loss by Instrument" bar chart shows how different underlying assets have performed.
- Identify which instruments have been most profitable for you and consider focusing more on these.

Study the Cumulative Profit/Loss Over Time:
- This line chart shows your overall performance trend.
- Look for periods of consistent gains and analyze what strategies you were using during those times.

Examine the Holding Period Analysis:
- This chart shows how long you typically hold your positions.
- Compare the average holding periods for profitable vs. unprofitable trades. This might reveal if you're closing profitable positions too early or holding onto losing positions for too long.

Review All Trades:
- The "All Trades" table at the bottom provides a detailed view of each transaction.
- Look for patterns in your successful trades, such as specific days of the week, times of day, or market conditions when you entered the trades.

To avoid repeating mistakes like your COIN options loss:
1. Set strict loss limits and stick to them.
2. Diversify your trades across different instruments to spread risk.
3. Pay attention to position sizing - avoid putting too much capital into a single trade.
4. Use the dashboard regularly to keep track of your performance and adjust your strategy as needed.`}
              />

              <Button 
                variant="contained" 
                color="secondary" 
                onClick={() => {
                  setNotes('');
                  localStorage.removeItem('tradingNotes');
                }}
                style={{ marginTop: '1rem' }}
              >
                Clear Notes
              </Button>

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
                      <TableCell>Strike</TableCell>
                      <TableCell>Price</TableCell>
                      <TableCell>Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.map((trade, index) => {
                      const parsedDescription = parseDescription(trade.Description);
                      let amount = trade.Amount.replace(/[^\d.-]/g, '');
                      if (trade.Amount.startsWith('(')) {
                        amount = -parseFloat(amount);
                      } else {
                        amount = parseFloat(amount);
                      }
                      return (
                        <TableRow key={index}>
                          <TableCell>{trade["Activity Date"]}</TableCell>
                          <TableCell>{trade.Instrument}</TableCell>
                          <TableCell>{trade.Description}</TableCell>
                          <TableCell>{trade["Trans Code"]}</TableCell>
                          <TableCell>{trade.Quantity}</TableCell>
                          <TableCell>${parsedDescription.strike || '0.00'}</TableCell>
                          <TableCell>{trade["Price"]}</TableCell>
                          <TableCell>${amount.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
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