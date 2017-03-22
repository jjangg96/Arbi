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

function get_profit(coin, site1, site2, krw, wait_trade) {
  buyer_fee = 0.0015;
  seller_fee = 0.0015;

  esti_qty = 0.0;
  esti_value = 0.0;
  origin_krw = krw;
  buy_qty = 0.0;
  buy_list = [];
  sell_list = [];

  //buy
  ask = orderbook[site1+'_'+coin].ask;
  bid = orderbook[site2+'_'+coin].bid;

  if(wait_trade) {
    esti_qty = (krw / parseInt(bid[0].price) * (1-buyer_fee));
    buy_list.push({price: bid[0].price, qty: esti_qty});
    krw = 0;
  } else {
    ask.forEach(function(item){
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
    esti_value = (esti_qty * parseInt(ask[0].price) * (1-seller_fee));
    sell_list.push({price: ask[0].price, qty: esti_qty});
    esti_qty = 0;
  } else {
    bid.forEach(function(item){
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
    buy_qty: buy_qty
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
