var arbiApp = angular.module('arbiApp', []);
arbiApp.filter('to_trusted', ['$sce', function($sce) {
    return function(text) {
        return $sce.trustAsHtml(text);
    };
}]);


arbiApp.controller('arbiController', function arbiController($scope) {
  $scope.coins = ['eth', 'etc']
  $scope.sites = ['coinone', 'korbit']
  $scope.krw = 5000000;
  $scope.arbi = {};
  //init
  $scope.coins.forEach(function(coin){
    $scope.arbi[coin] = {};
    $scope.sites.forEach(function(from){
      $scope.arbi[coin][from] = {};
    });
  });

  var orderbook_url = {
    //coinone_btc: 'https://api.coinone.co.kr/orderbook?currency=eth',
    coinone_eth: 'https://api.coinone.co.kr/orderbook?currency=eth',
    coinone_etc: 'https://api.coinone.co.kr/orderbook?currency=etc',
    //korbit_bth: 'http://j96.me:3000/get?url=https://api.korbit.co.kr/v1/orderbook?currency_pair=btc_krw',
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

    return parseInt((sum / origin_qty) / 100) * 100;
  }

  $scope.draw_table = function(title, list, price, qty) {
    if(list == undefined)
      return;

    var table = '<div class="' + title + '">';
    table += '<p>' + title + '</p>';
    table += '<table class="table table-bordered table-striped table-hover table-condensed">';
    table += "<thead>";
    table += "<tr><th>Price(" + price + ")</th><th>Qty(" + qty.toFixed(2) + ")</th></tr>";
    table += "</thead>";
    list.forEach(function(item){
      table += "<tr>";
      table += "<td>" + item.price + "</td><td>" + parseFloat(item.qty).toFixed(2) + "</td>";
      table += "</tr>";
    });
    table += "</table>";
    table += "</p>";
    return table;
  };

  function get_profit(coin, from, to, krw, wait_buy_trade, wait_sell_trade) {
    if(from == to || from == '' || to == '') {
      return {
        profit: 0,
        buy: [],
        sell: [],
        qty: 0,
        avg_buy_price: 0,
        avg_sell_price: 0,
        profit_percent: 0,
      };
    }
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


    if(wait_buy_trade) {
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
    if(wait_sell_trade) {
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
      avg_sell_price: get_avg_price(sell_list, buy_qty),
      profit_percent: (parseInt(esti_value - origin_krw) * 100) / origin_krw
    };
  }

  //update every sec
  update_orderbook();

  setInterval(function(){
    var wait_buy_trade = $('#wait_buy_trade').is(":checked");
    var wait_sell_trade = $('#wait_sell_trade').is(":checked");

    update_orderbook(function(){
      $scope.coins.forEach(function(coin){
        $scope.sites.forEach(function(from){
          $scope.sites.forEach(function(to){
            $scope.arbi[coin][from][to] = get_profit(coin, from, to, $scope.krw, wait_buy_trade, wait_sell_trade);
          });
        });
      });
      $scope.$apply();
    });
  }, 2000);
});



$(document).ready(function(){

});
