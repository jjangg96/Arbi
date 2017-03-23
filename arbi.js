var orderbook_url = {
  coinone_eth: 'https://api.coinone.co.kr/orderbook?currency=eth',
  coinone_etc: 'https://api.coinone.co.kr/orderbook?currency=etc',
  korbit_eth: 'http://j96.me:3000/get?url=https://api.korbit.co.kr/v1/orderbook?currency_pair=eth_krw',
  korbit_etc: 'http://j96.me:3000/get?url=https://api.korbit.co.kr/v1/orderbook?currency_pair=etc_krw',
};

var orderbook = {
  coinone_eth: {},
  coinone_etc: {},
  korbit_eth: {},
  korbit_etc: {}
};

//parse
function parse_orderbook(site, data) {
  if(data && typeof(data) === 'string')
    data = JSON.parse(data);

  if(data.hasOwnProperty('bids')) {
    if($.isArray(data['bids'][0])) {
      data['bid'] = [];
      data['bids'].forEach(function(item){
        data['bid'].push({price: item[0], qty: item[1] });
      });
    }
  }
  if(data.hasOwnProperty('asks')) {
    if($.isArray(data['asks'][0])) {
      data['ask'] = [];
      data['asks'].forEach(function(item){
        data['ask'].push({price: item[0], qty: item[1] });
      });
    }
  }

  data['site'] = site;

  return data;
}

//read orderbook
function get_orderbook(site, cb) {
  $.ajax({
    url: orderbook_url[site],
  }).done(function(data){
    data = parse_orderbook(site, data);
    if(cb) cb(data);
  }).fail(function(){
    if(cb) cb(null);
  });
}

function update_orderbook(cb) {
  Object.keys(orderbook_url).forEach(function(key){
    get_orderbook(key, function(data){
      orderbook[key] = data;
    });
  });
  if(cb) cb();
}

function get_avg_price(list, qty) {
  sum = 0.0;
  origin_qty = qty;

  list.forEach(function(item){
    if(qty <= item.qty) {
      sum += item.price * qty;
      qty -= qty;
    } else {
      sum += item.price * item.qty;
      qty -= item.qty;
    }
  });

  return parseInt(sum / origin_qty);
}

function get_profit(coin, from, to, krw, wait_trade) {
  buyer_fee = 0.0015;
  seller_fee = 0.0015;

  esti_qty = 0.0;
  esti_value = 0.0;
  origin_krw = krw;
  buy_qty = 0.0;
  buy_list = [];
  sell_list = [];

  //buy
  from_ask = orderbook[from+'_'+coin].ask;
  from_bid = orderbook[from+'_'+coin].bid;
  to_ask = orderbook[to+'_'+coin].ask;
  to_bid = orderbook[to+'_'+coin].bid;


  if(wait_trade) {
    esti_qty = (krw / parseInt(from_bid[0].price) * (1-buyer_fee));
    buy_list.push({price: from_bid[0].price, qty: esti_qty});
    krw = 0;
  } else {
    from_ask.forEach(function(item){
      var price = parseInt(item.price);
      var qty = parseFloat(item.qty);
      var value = price * qty;

      if(krw <= 0) {
      } else if(value >= krw) {
        buy_list.push(item);
        esti_qty += ((krw / (price * 1.0)) * (1-buyer_fee))
        krw -= krw;
      } else {
        buy_list.push(item);
        esti_qty += (qty * (1-buyer_fee));
        krw -= value;
      }
    });
  }

  buy_qty = esti_qty;

  //sell
  if(wait_trade) {
    esti_value = (esti_qty * parseInt(to_ask[0].price) * (1-seller_fee));
    sell_list.push({price: to_ask[0].price, qty: esti_qty});
    esti_qty = 0;
  } else {
    to_bid.forEach(function(item){
      var price = parseInt(item.price);
      var qty = parseFloat(item.qty);
      var value = price * qty;

      if(esti_qty <= 0) {
      } else if(esti_qty <= qty) {
        sell_list.push(item);
        esti_value += ((esti_qty * price) * (1-seller_fee));
        esti_qty -= esti_qty;
      } else {
        sell_list.push(item);
        esti_value += (value * (1-seller_fee));
        esti_qty -= qty;
      }
    });
  }

  return {
    profit: parseInt(esti_value - origin_krw),
    buy: buy_list,
    sell: sell_list,
    qty: buy_qty,
    avg_buy_price: get_avg_price(buy_list, buy_qty),
    avg_sell_price: get_avg_price(sell_list, buy_qty)
  };
}


$(document).ready(function(){
  //update every sec
  update_orderbook();

  setInterval(function(){
    var krw = parseInt($('#krw').val());
    var wait_trade = $('#wait_trade').is(":checked");
    update_orderbook(function(){
      $('#eth_korbit_coinone').html(get_profit('eth', 'korbit', 'coinone', krw, wait_trade).profit);
      $('#eth_coinone_korbit').html(get_profit('eth', 'coinone', 'korbit', krw, wait_trade).profit);
      $('#etc_korbit_coinone').html(get_profit('etc', 'korbit', 'coinone', krw, wait_trade).profit);
      $('#etc_coinone_korbit').html(get_profit('etc', 'coinone', 'korbit', krw, wait_trade).profit);
    });
  }, 2000);
});
