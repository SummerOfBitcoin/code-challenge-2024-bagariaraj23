## My Code's working solution Exlained:

The code has been completely written in Javascript using non bitcoin-specific libraries. I have made use of a few util functions and implemented them using the 'crypto' library of javascript as stated below:<br/>
    &emsp;reversedBytes    -  Reverse the bytes of a buffer <br/>
    &emsp;uint16ToBytes    -  Converts a number to 2 bytes representation <br/>
    &emsp;uint32ToBytes    -  Converts a number to 4 bytes representation <br/>
    &emsp;uint64ToBytes    -  Converts a number to 8 bytes representation <br/>
    &emsp;singleSHA256     -  Hash the data using SHA256 Algorithm <br/>
    &emsp;doubleSHA256     -  Double hash the data using SHA256 Algorithm <br/>
    &emsp;reverseHex       -  Reverse the Hex string to little endian <br/>
    &emsp;serializeVarInt  -  Serialize a number to a variable length integer <br/><br/>

# Input
**mempool**: containing several JSON file representing a transaction that includes all necessary information for validation.

# Output
**file**: output.txt with the following structure:<br/>
      &emsp;&emsp;First line: The block header. <br/>
      &emsp;&emsp;Second line: The serialized coinbase transaction. <br/>
      &emsp;&emsp;Following lines: The transaction IDs (txids) of the transactions mined in the block, in order. The first txid should be that of the coinbase transaction<br/><br/>
      
# Difficulty Target
**difficulty target**: ```0000ffff00000000000000000000000000000000000000000000000000000000```

# implementation process

**Step 1**: I started by reading files from the mempool and stored all the data from each file in an array "parsedArray"<br/><br/>
**Step 2**: Iterating through the parsedAraay for each transaction verified the transaction and calculated the following:\
        &emsp;&emsp;1. Weight of the transaction<br/>
        &emsp;&emsp;2. Transaction Fees<br/>
        &emsp;&emsp;3. Serialised Output<br/><br/>
        Again for Serialised Output we consider 2 types of transactions:<br/>
            &emsp;&emsp;&emsp;&emsp;
            a. Non Segwit Transactions: These do not contain the witness field and serialisation is done by considering:\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;version\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;input count<br/>
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;inputs\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;output count\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;outputs\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;locktime\
            &emsp;&emsp;&emsp;
            b. Segwit Transactions: These contains the witness field and serialisation is done by considering:\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;version\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;marker\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;flag\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;input count\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;inputs\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;output count\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;outputs\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;witness\
               &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;locktime\\
<br/><br/>
**Step 3**: feeArray and weightArray contains the txn fee and weights respectively. Txids contains the transaction ids calculated by running double SHA256 on the serialised Output and txidsArray contains the witness txids to be used for witness committment calculation.
<br/><br/>
**Step 4**: ***Calculation of the netReward*** by selecting the transactions in a decreasing order of transaction fee/weight ratio and considering the maximum block weight to be less than 4,000,000. 
        NetReward is then calculated by adding the txnFee of these selected transactions
        Total Weight is calculated by adding the weights of these selected transactions
        witnessCommitment is calculated by considering the wTxids of the selected transactions and double hash256 by witnessReserved Value i.e. 0x0
<br/><br/>   
**Step 5**: ***Coinbase Transaction creation***:
        I created a coinbase transaction by sending a random message and input txids as 0x0, output value as the netReward and taking into consideration the witnessCommitment calculated in above step.
<br/><br/>
**Step 6**: ***Merkle Root calculation***: 
        All the selected transactions including the transaction id of the coinbase txn. The transactions are double hashed by SHA256 algorithm by pairing transactions.
<br/><br/>
**Step 7**: The below parameters were taken into the account:\
        &emsp;&emsp;&emsp;&emsp;&emsp;**1. timestamp:** current time (at the time of running the code.\
        &emsp;&emsp;&emsp;&emsp;&emsp;**2. bits:** corrresponds to the difficulty target (0x1f00ffff here)\
        &emsp;&emsp;&emsp;&emsp;&emsp;**3. prevBlock_Hash:** hash of previous block (considered 0x00000000000000000000000000000000 here)\
        &emsp;&emsp;&emsp;&emsp;&emsp;**4. merkleRoot:** As calculated in Step 6.\
        &emsp;&emsp;&emsp;&emsp;&emsp;**5. coinbase transaction Id:** calculated in Step 5.\
        &emsp;&emsp;&emsp;&emsp;&emsp;**6. Selectedtxids:** transaction ids to be considered (selected in Step 4).\
        &emsp;&emsp;&emsp;&emsp;&emsp;**7. target:** given by the maintainer of the program as stated above.\
        &emsp;&emsp;&emsp;&emsp;&emsp;**8. Nonce:** calculation done by running the loop\
        &emsp;&emsp;&emsp;&emsp;&emsp;**9. version:** 0x00000007 here\
<br/><br/>
**Step 8**: Finally the block header calculation algorithm was written which would take into consideration the below parameters:\
        &emsp;&emsp;&emsp;&emsp;&emsp;**version**\
        &emsp;&emsp;&emsp;&emsp;&emsp;**prevBlock_Hash**\
        &emsp;&emsp;&emsp;&emsp;&emsp;**merkleRoot**\
        &emsp;&emsp;&emsp;&emsp;&emsp;**timestamp**\
        &emsp;&emsp;&emsp;&emsp;&emsp;**bits**\
        &emsp;&emsp;&emsp;&emsp;&emsp;**nonce**\
        and a loop was run which would calculate the header by double hash SHA256 the serialised Output of the block until the header hash would result in a value less tham the given difficulty target.
<br/><br/>
**Step 9**:\
        &emsp;&emsp;&emsp;&emsp;```The block header serialised output was logged```\
        &emsp;&emsp;&emsp;&emsp;```The serialised output of the coinbase transaction was logged```\
        &emsp;&emsp;&emsp;&emsp;```The txids of the selected transactions.```\
<br/><br/>
**Step 10**: A shell script was written to log all the above outputs to a file called as the "Output.txt"
<br/><br/><br/>
Therefore, I had to go through the above stated 10 steps in order to select and include the transactions in a block and then mine it.
