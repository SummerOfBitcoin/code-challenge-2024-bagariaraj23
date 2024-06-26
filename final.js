const fs = require('fs');
const {
    serializeVarInt,
    reversedBytes,
    doubleSHA256,
    reverseHex,
    singleSHA256
} = require('./utils/utilFunctions');

const checkSegwit = (txn) => {
    let segwit = false;
    for (const vin of txn.vin) {
        if (vin.witness) {
            segwit = true;
            break;
        }
    }
    return segwit;
}

// Serialization function for the Non-segwit transaction:
const txidCalc = (txn) => {
    let serializedOutput = [];
    let txnFee = 0;
    let inputValue = 0;
    let outputValue = 0;
    let weight = 0;

    const versionBytes = Buffer.alloc(4);
    versionBytes.writeUInt32LE(txn.version);
    serializedOutput.push(...versionBytes);

    // Serializing the vin count:
    const vinCount = BigInt(txn.vin.length);
    serializedOutput.push(...serializeVarInt(vinCount));

    // Serializing the vin:
    for (const vin of txn.vin) {
        inputValue += vin.prevout.value;

        const txidBytes = Buffer.from(vin.txid, 'hex');
        serializedOutput.push(...reversedBytes(txidBytes));

        const voutBytes = Buffer.alloc(4);
        voutBytes.writeUInt32LE(vin.vout);
        serializedOutput.push(...voutBytes);

        const scriptSigSize = BigInt(vin.scriptsig.length / 2);
        serializedOutput.push(...serializeVarInt(scriptSigSize));

        const scriptSigBytes = Buffer.from(vin.scriptsig, 'hex');
        serializedOutput.push(...scriptSigBytes);

        const sequenceBytes = Buffer.alloc(4)
        sequenceBytes.writeUInt32LE(vin.sequence);
        serializedOutput.push(...sequenceBytes);
    }

    // Serializing the vout count:
    const outputCountByte = BigInt(txn.vout.length);
    serializedOutput.push(...serializeVarInt(outputCountByte));

    // Serializing the vout:
    for (const vout of txn.vout) {
        outputValue += vout.value;

        amountBytes = Buffer.alloc(8);
        amountBytes.writeBigUInt64LE(BigInt(vout.value));
        serializedOutput.push(...amountBytes);

        const scriptPubKeyLengthBytes = BigInt(vout.scriptpubkey.length / 2);
        serializedOutput.push(...serializeVarInt(scriptPubKeyLengthBytes));

        const scriptPubKeyBytes = Buffer.from(vout.scriptpubkey, 'hex');
        serializedOutput.push(...scriptPubKeyBytes);
    }

    // Serializing the locktime:
    const locktimeBytes = Buffer.alloc(4);
    locktimeBytes.writeUInt32LE(txn.locktime);
    serializedOutput.push(...locktimeBytes);

    txnFee = inputValue - outputValue;

    weight += serializedOutput.length * 4;
    return { serializedOutput, txnFee, weight };
}

// Serialization function for the Segwit transaction:
const wTXIDCalc = (txn) => {
    let serializedOutput = [];
    let txnFee = 0;
    let inputValue = 0;
    let outputValue = 0;
    let weight = 0;
    let witnessBytesLength = 0;

    //Serializing the version:
    const versionBytes = Buffer.alloc(4);
    versionBytes.writeUInt32LE(txn.version);
    serializedOutput.push(...versionBytes);
    weight += versionBytes.length * 4;

    const markerBytes = Buffer.alloc(1);
    markerBytes.writeUInt8(0);
    serializedOutput.push(...markerBytes);
    weight += markerBytes.length * 1;
    witnessBytesLength += markerBytes.length * 1;

    const flagBytes = Buffer.alloc(1);
    flagBytes.writeUInt8(1);
    serializedOutput.push(...flagBytes);
    weight += flagBytes.length * 1;
    witnessBytesLength += flagBytes.length * 1;

    // Serializing the vin count:
    const vinCount = BigInt(txn.vin.length);
    serializedOutput.push(...serializeVarInt(vinCount));
    weight += serializeVarInt(vinCount).length * 4;

    // Serializing the vin:
    for (const vin of txn.vin) {
        inputValue += vin.prevout.value;

        const txidBytes = Buffer.from(vin.txid, 'hex');
        serializedOutput.push(...reversedBytes(txidBytes));
        weight += txidBytes.length * 4;

        const voutBytes = Buffer.alloc(4);
        voutBytes.writeUInt32LE(vin.vout);
        serializedOutput.push(...voutBytes);
        weight += voutBytes.length * 4;

        const scriptSigSize = BigInt(vin.scriptsig.length / 2);
        serializedOutput.push(...serializeVarInt(scriptSigSize));
        weight += serializeVarInt(scriptSigSize).length * 4;

        const scriptSigBytes = Buffer.from(vin.scriptsig, 'hex');
        serializedOutput.push(...scriptSigBytes);
        weight += scriptSigBytes.length * 4;

        const sequenceBytes = Buffer.alloc(4)
        sequenceBytes.writeUInt32LE(vin.sequence);
        serializedOutput.push(...sequenceBytes);
        weight += sequenceBytes.length * 4;
    }

    // Serializing the vout count:
    const outputCountByte = BigInt(txn.vout.length);
    serializedOutput.push(...serializeVarInt(outputCountByte));
    weight += serializeVarInt(outputCountByte).length * 4;

    // Serializing the vout:
    for (const vout of txn.vout) {
        outputValue += vout.value;

        amountBytes = Buffer.alloc(8);
        amountBytes.writeBigUInt64LE(BigInt(vout.value));
        serializedOutput.push(...amountBytes);
        weight += amountBytes.length * 4;

        const scriptPubKeyLengthBytes = BigInt(vout.scriptpubkey.length / 2);
        serializedOutput.push(...serializeVarInt(scriptPubKeyLengthBytes));
        weight += serializeVarInt(scriptPubKeyLengthBytes).length * 4;

        const scriptPubKeyBytes = Buffer.from(vout.scriptpubkey, 'hex');
        serializedOutput.push(...scriptPubKeyBytes);
        weight += scriptPubKeyBytes.length * 4;
    }

    serializedOutputBeforeWitness = serializedOutput.length;
    // Serializing the witness field if it's present:
    for (const vin of txn.vin) {
        if (vin.witness) {
            const witnessCount = BigInt(vin.witness.length);
            serializedOutput.push(...serializeVarInt(witnessCount));
            for (const witness of vin.witness) {
                const witnessBytes = Buffer.from(witness, 'hex');
                const witnessLength = BigInt(witnessBytes.length);
                const serializedVarInt = serializeVarInt(witnessLength);

                // Push the serialized variable integer first
                serializedOutput.push(...serializedVarInt);

                // Split the witness bytes into smaller chunks (e.g., 100 bytes each)
                const chunkSize = 1000;
                for (let i = 0; i < witnessBytes.length; i += chunkSize) {
                    const chunk = witnessBytes.slice(i, i + chunkSize);
                    serializedOutput.push(...chunk);
                }
            }
        } else {
            serializedOutput.push(0);
        }
    }

    serializedOutputAfterWitness = serializedOutput.length;
    WitnessContentLength = serializedOutputAfterWitness - serializedOutputBeforeWitness;

    weight += WitnessContentLength * 1;
    witnessBytesLength += WitnessContentLength * 1;

    // Serializing the locktime:
    const locktimeBytes = Buffer.alloc(4);
    locktimeBytes.writeUInt32LE(txn.locktime);
    serializedOutput.push(...locktimeBytes);
    weight += locktimeBytes.length * 4;

    txnFee = inputValue - outputValue;

    return { serializedOutput, txnFee, weight, witnessBytesLength };
}

// this function returns the rxids, wtxids, weight, fee and the filenames for each files in a "considerationArray"
function operation(parsedArray) {
    let txidArray = [];
    let txidReverse = [];
    let fileNameAfterOperation = [];
    let feeArray = [];
    let weightArray = [];
    let txids = [];
    let considerationArray = [];

    parsedArray.map((data) => {
        let weightFinal = 0;
        let { serializedOutput, txnFee, weight } = txidCalc(data);
        const serializedOut = serializedOutput.map(byte => {
            return byte.toString(16).padStart(2, '0');
        }).join('');

        const txid1 = doubleSHA256(Buffer.from(serializedOut, 'hex'));
        txids.push(txid1);
        weightFinal += weight;

        if (checkSegwit(data)) {
            let { serializedOutput, txnFee, weight, witnessBytesLength } = wTXIDCalc(data);

            const serializedOut = serializedOutput.map(byte => {
                return byte.toString(16).padStart(2, '0');
            }).join('');
            weightFinal += witnessBytesLength;
            weight = weightFinal

            weightArray.push(weight);

            const txid = doubleSHA256(Buffer.from(serializedOut, 'hex'));
            txidArray.push(txid);


            const txidReversed = reverseHex(txid1);
            txidReverse.push(txidReversed);

            const fileName = singleSHA256(txidReversed) + ".json"
            fileNameAfterOperation.push(fileName);

            feeArray.push(txnFee);
            considerationArray.push({ fileName, txid: txid1, txnFee, weight, wTxid: txid });
        }
        else {
            let { serializedOutput, txnFee, weight } = txidCalc(data);

            const serializedOut = serializedOutput.map(byte => {
                return byte.toString(16).padStart(2, '0');
            }).join('');
            weightArray.push(weight);

            const txid = doubleSHA256(Buffer.from(serializedOut, 'hex'));
            txidArray.push(txid);


            const txidReversed = reverseHex(txid);
            txidReverse.push(txidReversed);

            const fileName = singleSHA256(txidReversed) + ".json"
            fileNameAfterOperation.push(fileName);

            feeArray.push(txnFee);
            considerationArray.push({ fileName, txid: txid, txnFee, weight, wTxid: txid });
        }
    })

    return { considerationArray, weightArray, txidArray, txids }
}

function fetchDataFromFiles() {
    const folder = "./mempool";
    let fileArray = []
    let count = 0;
    fs.readdirSync(folder).forEach(file => {
        fileArray.push(file);
        count++;
    }
    );

    let DataArray = [];

    // map through each files in the fileArray.json
    fileArray.map((files) => {
        let data = fs.readFileSync(`./mempool/${files}`, 'utf8')
        DataArray.push(data);
    })

    // contains all the data from the files in the mempool folder in sorted order of files:
    const parsedArray = DataArray.map(item => JSON.parse(item));
    return parsedArray;
}

//merkle root implementation where the txids are concatenated and then db256 hashed (in takes the txids in reverse order already)
function merkleRoot(txids) {
    if (txids.length === 1) {
        return txids[0];
    }

    const result = [];

    for (let i = 0; i < txids.length; i += 2) {
        const one = txids[i];
        const two = txids[i + 1] ? txids[i + 1] : one;
        const concat = one + two;

        result.push(doubleSHA256(concat));
    }

    return merkleRoot(result);
}

function wTxidCommitment(finalWTxidArray) {
    let wTxidArray = [];
    let cbtxId = "0000000000000000000000000000000000000000000000000000000000000000"
    wTxidArray.push(cbtxId);
    wTxidArray.push(...finalWTxidArray);

    const wTxidByteOrder = wTxidArray.map(x => x.match(/../g).reverse().join(''));
    let wTxidMerkleRoot = merkleRoot(wTxidByteOrder);

    let witnessReservedValue = "0000000000000000000000000000000000000000000000000000000000000000";

    wTxidComm = wTxidMerkleRoot + witnessReservedValue;
    wTxidCommFinal = singleSHA256(wTxidComm);

    return wTxidCommFinal;
}

function coinbaseTxidCalc(parsedData) {
    const data = parsedData;
    let weightFinal = 0;
    let wTxid = 0;
    let txidReversed = 0;
    let segwitSerializedOutput = [];

    let { serializedOutput, txnFee, weight } = txidCalc(data);
    const serializedOut = serializedOutput.map(byte => {
        return byte.toString(16).padStart(2, '0');
    }).join('');

    const txid1 = doubleSHA256(Buffer.from(serializedOut, 'hex'));
    weightFinal += weight;

    if (checkSegwit(data)) {
        let { serializedOutput, txnFee, weight, witnessBytesLength } = wTXIDCalc(data);
        const serializedOut = serializedOutput.map(byte => {
            return byte.toString(16).padStart(2, '0');
        }).join('');

        weightFinal += witnessBytesLength;
        weight = weightFinal;

        wTxid = doubleSHA256(Buffer.from(serializedOut, 'hex'));

        segwitSerializedOutput = serializedOutput.map(byte => {
            return byte.toString(16).padStart(2, '0');
        }
        ).join('');
    }

    return { txid1, wTxid, weight, serializedOut, segwitSerializedOutput };
}

function coinbaseTxn(fileArray, finalWTxidArray) {
    let block_Height = 840000;
    block_Height = block_Height.toString(16);
    block_Height = block_Height.padStart(6, '0');
    block_Height = reverseHex(block_Height);

    let netReward = 0;

    for (const files of fileArray) {
        let fee = 0;
        let input = 0;
        let output = 0;
        const data = fs.readFileSync(`./mempool/${files}`, 'utf8');
        const parsedData = JSON.parse(data);

        for (const vin of parsedData.vin) {
            input += vin.prevout.value;
        }
        for (const vout of parsedData.vout) {
            output += vout.value;
        }

        fee = input - output;
        netReward += fee;
    }

    netReward += (3.125 * 100000000);

    let commitmentHeader = "aa21a9ed";
    let wTxidCommFinal = wTxidCommitment(finalWTxidArray);

    let scriptpubkeysize = (4 + commitmentHeader.length + wTxidCommFinal.length);
    scriptpubkeysize = scriptpubkeysize / 2;
    scriptpubkeysize = scriptpubkeysize.toString(16);
    scriptpubkeysize = scriptpubkeysize.padStart(2, '0');

    const coinbaseTx = {
        "version": 1,
        "marker": "00",
        "flag": "01",
        "inputcount": "01",
        "vin": [
            {
                "txid": "0000000000000000000000000000000000000000000000000000000000000000",
                "vout": "ffffffff",
                "prevout": {
                    value: netReward
                },
                "scriptsigsize": "32",
                "scriptsig": "03" + block_Height + "135368726579612052616a204261676172696120076c0000946e0100",
                "witness": [
                    "0000000000000000000000000000000000000000000000000000000000000000",
                ],
                "sequence": "ffffffff"
            },
        ],
        "outputcount": "02",
        "vout": [
            {
                "value": netReward,
                "scriptpubkeysize": "19",
                "scriptpubkey": "76a91455ae51684c43435da751ac8d2173b2652eb6410588ac"
            },
            {
                "value": 0,
                "scriptpubkeysize": scriptpubkeysize,
                "scriptpubkey": "6a" + "24" + commitmentHeader + wTxidCommFinal,
            }
        ],
        "witness": [{
            "stackitems": "01",
            "0": {
                "size": "20",
                "item": "0000000000000000000000000000000000000000000000000000000000000000"
            }
        }
        ],
        "locktime": "00000000",
    };

    const { txid1, wTxid, weight, serializedOut, segwitSerializedOutput } = coinbaseTxidCalc(coinbaseTx);

    return { txid1, serializedOut, segwitSerializedOutput };
}

// calls the coinbaseTxn function and returns the required values for mining the block (timestamp, nonce, bits, prevBlock_Hash, merkleRoot)
function preMineBlock(considerationArray) {
    const prevBlock_Hash = 0x00000000000000000000000000000000;

    const currentTime = Math.floor(Date.now() / 1000);
    const timestamp = currentTime;

    const bits = 0x1f00ffff;

    data = considerationArray;
    data.sort((a, b) => (a.txnFee / a.weight) - (b.txnFee / b.weight));
    data.reverse();

    let finalTxidArray = [];
    let finalWTxidArray = [];
    let consideredFiles = [];
    let weightCount = 0;
    let feeCount = 0;
    let cnt = 0;
    let capacity = 4000000;

    for (let i = 0; i < data.length; i++) {
        if (capacity > 1000) {
            weightCount += data[i].weight;
            finalTxidArray.push(data[i].txid);
            finalWTxidArray.push(data[i].wTxid);
            consideredFiles.push(data[i].fileName);
            feeCount += data[i].txnFee;
            cnt++;
            capacity -= data[i].weight;
        }
    }

    // txid1 is the non segwit Txid
    // serializedOut is the non segwit serialisedOutput
    // segwitSerializedOutput is the segwit serialisedOutput
    const { txid1, serializedOut, segwitSerializedOutput } = coinbaseTxn(consideredFiles, finalWTxidArray);

    let selectedTxids = [];
    selectedTxids.push(txid1);
    selectedTxids.push(...finalTxidArray);
    //reverse the txids in selectedTxids
    selectedTxids = selectedTxids.map(x => x.match(/../g).reverse().join(''));

    const txidsByteOrder = selectedTxids.map(x => x.match(/../g).reverse().join(''));

    const result = merkleRoot(txidsByteOrder);

    return { timestamp, bits, prevBlock_Hash, result, txid1, selectedTxids, serializedOut, segwitSerializedOutput };
}

// function to mine the block
function mineBlock(timestamp, bits, prevBlock_Hash, result, nonce) {

    const blockHeader = {
        "version": 0x00000007,
        "prevBlock_Hash": prevBlock_Hash,
        "merkleRoot": result,
        "timestamp": timestamp,
        "bits": bits,
        "nonce": nonce
    }

    const blockHeaderSerialized = [];
    const versionBytes = Buffer.alloc(4);
    versionBytes.writeUInt32LE(blockHeader.version);
    blockHeaderSerialized.push(...versionBytes);

    const prevBlock_HashBytes = Buffer.alloc(32);
    prevBlock_HashBytes.writeUInt32LE(blockHeader.prevBlock_Hash);
    blockHeaderSerialized.push(...prevBlock_HashBytes);

    const merkleRootBytes = Buffer.from(blockHeader.merkleRoot, 'hex');
    blockHeaderSerialized.push(...merkleRootBytes);

    const timestampBytes = Buffer.alloc(4);
    timestampBytes.writeUInt32LE(blockHeader.timestamp);
    blockHeaderSerialized.push(...timestampBytes);

    const bitsBytes = Buffer.alloc(4);
    bitsBytes.writeUInt32LE(blockHeader.bits);
    blockHeaderSerialized.push(...bitsBytes);

    const nonceBytes = Buffer.alloc(4);
    nonceBytes.writeUInt32LE(blockHeader.nonce);
    blockHeaderSerialized.push(...nonceBytes);

    const blockHeaderSerializedHex = blockHeaderSerialized.map(byte => {
        return byte.toString(16).padStart(2, '0');
    }
    ).join('');

    let blockHeaderHash = doubleSHA256(Buffer.from(blockHeaderSerializedHex, 'hex'));

    blockHeaderHash = reverseHex(blockHeaderHash);

    return blockHeaderHash;
}

// returns the serialisedOutput of the block header which satisfies the condition
function mined(timestamp, bits, prevBlock_Hash, result, nonce) {

    const blockHeader = {
        "version": 0x00000007,
        "prevBlock_Hash": prevBlock_Hash,
        "merkleRoot": result,
        "timestamp": timestamp,
        "bits": bits,
        "nonce": nonce
    }

    const blockHeaderSerialized = [];
    const versionBytes = Buffer.alloc(4);
    versionBytes.writeUInt32LE(blockHeader.version);
    blockHeaderSerialized.push(...versionBytes);

    const prevBlock_HashBytes = Buffer.alloc(32);
    prevBlock_HashBytes.writeUInt32LE(blockHeader.prevBlock_Hash);
    blockHeaderSerialized.push(...prevBlock_HashBytes);

    const merkleRootBytes = Buffer.from(blockHeader.merkleRoot, 'hex');
    blockHeaderSerialized.push(...merkleRootBytes);

    const timestampBytes = Buffer.alloc(4);
    timestampBytes.writeUInt32LE(blockHeader.timestamp);
    blockHeaderSerialized.push(...timestampBytes);

    const bitsBytes = Buffer.alloc(4);
    bitsBytes.writeUInt32LE(blockHeader.bits);
    blockHeaderSerialized.push(...bitsBytes);

    const nonceBytes = Buffer.alloc(4);
    nonceBytes.writeUInt32LE(blockHeader.nonce);
    blockHeaderSerialized.push(...nonceBytes);

    const blockHeaderSerializedHex = blockHeaderSerialized.map(byte => {
        return byte.toString(16).padStart(2, '0');
    }
    ).join('');

    return blockHeaderSerializedHex;
}


function main(){
    const parsedArray = fetchDataFromFiles();

    // considerationArray contains all the features of the txns: weight, fee, txid, wtxid
    // weightArray contains the weight of all the txns
    // txidArray contains the wTxids of the txns
    // txids contains the txids of the txns
    let { considerationArray, weightArray, txidArray, txids } = operation(parsedArray);

    // We have got everything to mine the block :
    // timestamp = time.now();
    // bits = 1f00ffff;
    // prevBlock_Hash = 0x0;
    // result = merkleRoot of the txids(non segwit txids);
    // txid1 = non segwit txid of the coinbase txn;
    // selectedTxids = including the coinbase txn non segwit txid, all the other included txn's non segwit txids;
    // serializedOut = serializedOutput of the coinbase txn;
    // segwitSerializedOutput = segwit serializedOutput of the coinbase txn;
    const { timestamp, bits, prevBlock_Hash, result, txid1, selectedTxids, serializedOut, segwitSerializedOutput } = preMineBlock(considerationArray);

    let nonce = 0;
    let blockHeaderHash = mineBlock(timestamp, bits, prevBlock_Hash, result, nonce);
    let target = "0000ffff00000000000000000000000000000000000000000000000000000000";

    // looping through until i get the block header less than the difficulty target
    while (true) {
        if (blockHeaderHash < target) {
            break;
        } else {
            nonce++;
            blockHeaderHash = mineBlock(timestamp, bits, prevBlock_Hash, result, nonce);
        }
    }

    // I get the nonce value for which the condition is satisfied, now bring the serializedOutput of the block header
    let blockHeaderSerializedHex = mined(timestamp, bits, prevBlock_Hash, result, nonce);


    // Required answers:
    // 1. serialised Block Header
    // 2. Non-segwit serialised Output of the coinbase txn
    // 3. Txids for the txns included in the block
    console.log(blockHeaderSerializedHex);
    console.log(segwitSerializedOutput);
    selectedTxids.forEach(txid => {
        console.log(txid);
    });

}

main();