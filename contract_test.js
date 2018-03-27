var solc = require('solc');
var Web3 = require('web3');

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

// You must set this ENV VAR before testing
//assert.notEqual(typeof(process.env.ETH_NODE),'undefined');
var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;

var creator;
var escrow;
var buyer;

var initialBalanceCreator = 0;
var initialBalanceEscrow = 0;
var initialBalanceBuyer = 0;

var contractAddress;
var contract;

// init BigNumber
var unit = new BigNumber(Math.pow(10,18));

function diffWithGas(mustBe,diff){
     var gasFee = 12000000;
     return (diff>=mustBe) && (diff<=mustBe + gasFee);
}

function getContractAbi(contractName,cb){
     var file = './contracts/AWM.sol';

     fs.readFile(file, function(err, result){
          assert.equal(err,null);

          var source = result.toString();
          assert.notEqual(source.length,0);

          var output = solc.compile(source, 1);   // 1 activates the optimiser
          var abi = JSON.parse(output.contracts[contractName].interface);
          return cb(null,abi);
     });
}

function deployContract(data,cb){
     var file = './contracts/AWM.sol';
     var contractName = ':PresaleToken';

     fs.readFile(file, function(err, result){
          assert.equal(err,null);

          var source = result.toString();
          assert.notEqual(source.length,0);

          assert.equal(err,null);

          var output = solc.compile(source, 0); // 1 activates the optimiser

          //console.log('OUTPUT: ');
          //console.log(output.contracts);

          var abi = JSON.parse(output.contracts[contractName].interface);
          var bytecode = output.contracts[contractName].bytecode;
          var tempContract = web3.eth.contract(abi);

          var alreadyCalled = false;

          tempContract.new(
               creator,
               escrow,
               {
                    from: creator, 
                    // should not exceed 5000000 for Kovan by default
                    gas: 4995000,
                    //gasPrice: 120000000000,
                    data: '0x' + bytecode
               }, 
               function(err, c){
                    assert.equal(err, null);

                    console.log('TX HASH: ');
                    console.log(c.transactionHash);

                    // TX can be processed in 1 minute or in 30 minutes...
                    // So we can not be sure on this -> result can be null.
                    web3.eth.getTransactionReceipt(c.transactionHash, function(err, result){
                         //console.log('RESULT: ');
                         //console.log(result);

                         assert.equal(err, null);
                         assert.notEqual(result, null);

                         contractAddress = result.contractAddress;
                         contract = web3.eth.contract(abi).at(contractAddress);

                         console.log('Contract address: ');
                         console.log(contractAddress);

                         if(!alreadyCalled){
                              alreadyCalled = true;

                              return cb(null);
                         }
                    });
               });
     });
}

describe('Contracts 0 - Deploy', function() {
     before("Initialize everything", function(done) {
          web3.eth.getAccounts(function(err, as) {
               if(err) {
                    done(err);
                    return;
               }

               accounts = as;
               creator = accounts[0];
               escrow = accounts[1];
               buyer = accounts[2];

               var contractName = ':PresaleToken';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};
          deployContract(data,function(err){
               assert.equal(err,null);

               done();
          });
     });

     it('should get initial balances',function(done){
          initialBalanceCreator = web3.eth.getBalance(creator);
          initialBalanceEscrow = web3.eth.getBalance(escrow);
          initialBalanceBuyer = web3.eth.getBalance(buyer);

          done();
     });

     it('should get initial token balances',function(done){
          var balance = contract.balanceOf(creator);
          assert.equal(balance,0);

          balance = contract.balanceOf(escrow);
          assert.equal(balance,0);

          balance = contract.balanceOf(buyer);
          assert.equal(balance,0);

          done();
     });

     it('should get initial state',function(done){
          var state = contract.getCurrentState();
          assert.equal(state,0);
          done();
     });

     it('should throw if state is INIT',function(done){
          // 0.2 ETH
          var amount = 200000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);

                    done();
               }
          );
     });

     it('should not move state if not owner',function(done){
          contract.setPresaleState(
               1,
               {
                    from: buyer,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     })

     it('should get token manager',function(done){
          var m = contract.getTokenManager();
          assert.equal(m,creator);
          done();
     });

     it('should get crowdsale manager',function(done){
          var m = contract.getCrowdsaleManager();
          assert.equal(m,0);
          done();
     });

     it('should move state',function(done){
          contract.setPresaleState(
               1,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    console.log('Err:');
                    console.log(err);

                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     })

     it('should get updated state',function(done){
          var state = contract.getCurrentState();
          assert.equal(state,1);
          done();
     })

     it('should buy tokens',function(done){
          // 0.2 ETH
          var amount = 200000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     });

     /////// 
     it('should get updated Buyers balance',function(done){
          // 1 - tokens
          var tokens = contract.balanceOf(buyer);
          assert.equal(tokens,200000000000000000 * 1000);
          assert.equal(tokens / 1000000000000000000,200);   // 200 tokens (converted)

          // 2 - ETHs
          var currentBalance= web3.eth.getBalance(buyer);
          var diff = initialBalanceBuyer - currentBalance;
          var mustBe = 200000000000000000;

          assert.equal(diffWithGas(mustBe,diff),true);

          done();
     });

// pause
     it('should pause',function(done){
          contract.setPresaleState(
               2,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     })

     it('should get updated state',function(done){
          var state = contract.getCurrentState();
          assert.equal(state,2);
          done();
     })

     it('should throw if paused',function(done){
          // 0.3 ETH
          var amount = 300000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);

                    done();
               }
          );
     });

     it('should un-pause',function(done){
          contract.setPresaleState(
               1,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     })

     it('should get updated state',function(done){
          var state = contract.getCurrentState();
          assert.equal(state,1);
          done();
     })

     it('should buy more tokens',function(done){
          // 0.3 ETH
          var amount = 300000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     });

     /////// 
     it('should get updated Buyers balance',function(done){
          // 1 - tokens
          var tokens = contract.balanceOf(buyer);
          assert.equal(tokens / 1000000000000000000,500);   // 500 tokens (converted)

          // 2 - ETHs
          var currentBalance= web3.eth.getBalance(buyer);
          var diff = initialBalanceBuyer - currentBalance;
          var mustBe = 500000000000000000;

          assert.equal(diffWithGas(mustBe,diff),true);

          done();
     });

// migrating
     it('should not move to migration if no crowdsale manager is set',function(done){
          contract.setPresaleState(
               3,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);

                    done();
               }
          );
     })

     it('should get same state',function(done){
          var state = contract.getCurrentState();
          assert.equal(state,1);
          done();
     })

     //////// 
     it('should set crowdsale manager',function(done){
          contract.setCrowdsaleManager(
               creator,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     })

     it('should get updated crowdsale manager',function(done){
          var m = contract.getCrowdsaleManager();
          assert.equal(m,creator);
          done();
     });

     it('should move to migration',function(done){
          contract.setPresaleState(
               3,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     })

     it('should get same state',function(done){
          var state = contract.getCurrentState();
          assert.equal(state,3);
          done();
     })

     it('should get price',function(done){
          var price = contract.getPrice();
          assert.equal(price,1000);
          done();
     })

     it('should get totalSupply',function(done){
          var total = contract.getTotalSupply();
          assert.equal(total,500000000000000000000);
          done();
     })
});


