var arbiApp = angular.module('arbiApp', []);

arbiApp.filter('to_trusted', ['$sce', function($sce) {
  return function(text) {
    return $sce.trustAsHtml(text);
  };
}]);

arbiApp.filter('krw', function() {
  return function(n) {
    return numeral(n).format('0,0');
  };
});


arbiApp.controller('arbiController', function arbiController($scope) {
  $scope.coins = ['btc', 'eth', 'etc']
  $scope.sites = ['coinone', 'korbit', 'bithumb']
  $scope.krw = 5000000;
  $scope.arbi = {};
  $scope.orderbook = {};

  $scope.yobit_dash = 0;
  $scope.btce_dash = 0;
  $scope.btce_eth = 0;
  $scope.btce_ltc = 0;
  $scope.btce_dash_eth = 0;
  $scope.btce_ltc_eth = 0;
  $scope.bithumb_dash = 0;
  $scope.bithumb_eth = 0;
  $scope.bithumb_ltc = 0;

  $scope.coinone_xrp = 0;
  $scope.poloniex_xrp_krw = 0;
  $scope.poloniex_xrp = 0;

  //init
  $scope.coins.forEach(function(coin){
    $scope.arbi[coin] = {};
    $scope.orderbook[coin] = {};
    $scope.sites.forEach(function(site){
      $scope.arbi[coin][site] = {};
      $scope.orderbook[coin][site] = {};
    });
  });

  var get_orderbook_url = function(coin, site){
    if(site == 'coinone')
      return 'https://api.coinone.co.kr/orderbook?currency=' + coin;
    if(site == 'korbit')
      return 'http://j96.me:3000/get?url=https://api.korbit.co.kr/v1/orderbook?currency_pair=' + coin + '_krw';
    if(site == 'bithumb')
      return 'http://j96.me:3000/get?url=https://api.bithumb.com/public/orderbook/' + coin;
    else {
      console.log('no site');
    }
  };



  //parse
  function parse_orderbook(site, data) {
    data['bid'] = [];
    data['ask'] = [];

    try {

    } catch (e) {
      if(data && typeof(data) === 'string')
        data = JSON.parse(data);

      if(site == 'bithumb') {

        if(data['data']['bids'].length > 0) {
          data['data']['bids'].forEach(function(item){
            data['bid'].push({price: item.price, qty: item.quantity });
          });
        }

        if(data['data']['asks'].length > 0) {
          data['data']['asks'].forEach(function(item){
            data['ask'].push({price: item.price, qty: item.quantity });
          });
        }

      }

      if(site == 'korbit') {
        if($.isArray(data['bids'][0])) {
          data['bid'] = [];
          data['bids'].forEach(function(item){
            data['bid'].push({price: item[0], qty: item[1] });
          });
        }

        if($.isArray(data['asks'][0])) {
          data['ask'] = [];
          data['asks'].forEach(function(item){
            data['ask'].push({price: item[0], qty: item[1] });
          });
        }
      }
    } finally {
    }

    data['site'] = site;

    return data;
  }

  function get_json(url, cb) {
    $.ajax({
      url: url,
    }).done(function(data){
      if(cb) cb(data);
    }).fail(function(){
      if(cb) cb(null);
    });
  }

  //read orderbook
  function get_orderbook(coin, site, cb) {
    $.ajax({
      url: get_orderbook_url(coin, site),
    }).done(function(data){
      data = parse_orderbook(site, data);
      if(cb) cb(data);
    }).fail(function(){
      if(cb) cb(null);
    });
  }

  function update_orderbook(cb) {
    $scope.coins.forEach(function(coin){
      $scope.sites.forEach(function(site){
        get_orderbook(coin, site, function(data){
          $scope.orderbook[coin][site] = data;
        });
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
    table += "<tr><th>Price(" + numeral(price).format('0,0') + ")</th><th>Qty(" + numeral(qty.toFixed(2)).format('0,0') + ")</th></tr>";
    table += "</thead>";
    list.forEach(function(item){
      table += "<tr>";
      table += "<td>" + numeral(item.price).format('0,0') + "</td><td>" + numeral(parseFloat(item.qty).toFixed(2)).format('0,0') + "</td>";
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

    from_ask = $scope.orderbook[coin][from].ask;
    from_bid = $scope.orderbook[coin][from].bid;
    to_ask = $scope.orderbook[coin][to].ask;
    to_bid = $scope.orderbook[coin][to].bid;

    if(to_ask == undefined || to_bid == undefined || from_ask == undefined || from_bid == undefined)
      return;

    if(to_ask.length <= 0 || to_bid.length <= 0 || from_bid.length <= 0 || from_ask.lenght <= 0) {
      esti_value = 0;
      esti_qty = 0;
    } else {
      //buy
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
    get_json('https://poloniex.com/public?command=returnTicker', function(data) {
      get_json('http://api.coinone.co.kr/ticker?currency=all', function(data2) {
        $scope.poloniex_xrp_krw = data.BTC_XRP.last * data2.btc.last;
        $scope.poloniex_xrp = data.BTC_XRP.last;
        $scope.coinone_xrp = data2.xrp.last;

        document.title = "" + $scope.coinone_xrp + "/" + parseInt(data.BTC_XRP.last * data2.btc.last);
      });
    });
    
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

    // //bithumb
    // get_json('http://j96.me:3000/get?url=https://www.bithumb.com/trade/getAsset/DASH', function(data) {
    //   $scope.bithumb_dash = JSON.parse(data).data.DASH.LAST;
    // });
    //
    // get_json('http://j96.me:3000/get?url=https://www.bithumb.com/trade/getAsset/DASH', function(data) {
    //   $scope.bithumb_ltc = JSON.parse(data).data.LTC.LAST;
    // });
    //
    // get_json('http://j96.me:3000/get?url=https://www.bithumb.com/trade/getAsset/DASH', function(data) {
    //   $scope.bithumb_eth = JSON.parse(data).data.ETH.LAST;
    // });
    //
    // //dash yobit
    // get_json('http://j96.me:3000/get?url=https://yobit.net/api/3/depth/dash_btc?limit=100', function(data) {
    //   data = JSON.parse(data);
    //   sum_price = 0.0;
    //   sum_qty = 0.0;
    //   count = 0;
    //
    //   data.dash_btc.asks.forEach(function(item) {
    //     if(sum_qty < 50) {
    //       sum_price += item[0];
    //       sum_qty += item[1];
    //       count++;
    //     }
    //   });
    //
    //   price = sum_price / count;
    //
    //   $scope.yobit_dash = parseInt(price * $scope.orderbook['btc']['bithumb']['bid'][0].price);
    //
    // });

    // //btc-e
    // get_json('http://j96.me:3000/get?url=https://btc-e.com/api/3/depth/dsh_btc', function(data) {
    //   data = JSON.parse(data);
    //   sum_price = 0.0;
    //   sum_qty = 0.0;
    //   count = 0;
    //
    //   data.dsh_btc.asks.forEach(function(item) {
    //     if(sum_qty < 50) {
    //       sum_price += item[0];
    //       sum_qty += item[1];
    //       count++;
    //     }
    //   });
    //
    //   price = sum_price / count;
    //
    //   $scope.btce_dash = parseInt(price * $scope.orderbook['btc']['bithumb']['bid'][0].price);
    //
    // });
    //
    // get_json('http://j96.me:3000/get?url=https://btc-e.com/api/3/depth/ltc_btc', function(data) {
    //   data = JSON.parse(data);
    //   sum_price = 0.0;
    //   sum_qty = 0.0;
    //   count = 0;
    //
    //   data.ltc_btc.asks.forEach(function(item) {
    //     if(sum_qty < 50) {
    //       sum_price += item[0];
    //       sum_qty += item[1];
    //       count++;
    //     }
    //   });
    //
    //   price = sum_price / count;
    //
    //   $scope.btce_ltc = parseInt(price * $scope.orderbook['btc']['bithumb']['bid'][0].price);
    //
    // });
    //
    // get_json('http://j96.me:3000/get?url=https://btc-e.com/api/3/depth/eth_btc', function(data) {
    //   data = JSON.parse(data);
    //   sum_price = 0.0;
    //   sum_qty = 0.0;
    //   count = 0;
    //
    //   data.eth_btc.asks.forEach(function(item) {
    //     if(sum_qty < 50) {
    //       sum_price += item[0];
    //       sum_qty += item[1];
    //       count++;
    //     }
    //   });
    //
    //   price = sum_price / count;
    //
    //   $scope.btce_eth = parseInt(price * $scope.orderbook['btc']['bithumb']['bid'][0].price);
    //
    // });
    //
    // get_json('http://j96.me:3000/get?url=https://btc-e.com/api/3/depth/dsh_eth', function(data) {
    //   data = JSON.parse(data);
    //   sum_price = 0.0;
    //   sum_qty = 0.0;
    //   count = 0;
    //
    //   data.dsh_eth.asks.forEach(function(item) {
    //     if(sum_qty < 50) {
    //       sum_price += item[0];
    //       sum_qty += item[1];
    //       count++;
    //     }
    //   });
    //
    //   price = sum_price / count;
    //
    //   $scope.btce_dash_eth = parseInt(price * $scope.orderbook['eth']['bithumb']['bid'][0].price);
    //
    // });
    //
    // get_json('http://j96.me:3000/get?url=https://btc-e.com/api/3/depth/eth_ltc', function(data) {
    //   data = JSON.parse(data);
    //   sum_price = 0.0;
    //   sum_qty = 0.0;
    //   count = 0;
    //
    //   data.eth_ltc.bids.forEach(function(item) {
    //     if(sum_qty < 50) {
    //       sum_price += item[0];
    //       sum_qty += item[1];
    //       count++;
    //     }
    //   });
    //
    //   price = sum_price / count;
    //
    //   $scope.btce_ltc_eth = parseInt($scope.orderbook['eth']['bithumb']['bid'][0].price / price);
    //
    // });


  }, 2000);
});



$(document).ready(function(){

});
