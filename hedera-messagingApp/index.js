import dotenv from 'dotenv';
import { Client,
     AccountBalanceQuery,
    TopicCreateTransaction,
TopicMessageSubmitTransaction,
TopicMessageQuery } from '@hashgraph/sdk';
import crypto from "crypto";
import { encrypt, decrypt } from "./crypto.js";
import { subscribe } from 'diagnostics_channel';

dotenv.config();

const client = Client.forTestnet();
client.setOperator(process.env.OPERATOR_ID, process.env.OPERATOR_KEY);

const AES_KEY = crypto.randomBytes(32);
const FILTER_KEYWORD = "Hedera";
const messages = [
    "Hello, Hedera!",
    "Learning HCS",
    "Message 3"
];



async function main(){
    console.log("Creating topic");
    const tx=await new TopicCreateTransaction().execute(client);
    const receipt=await tx.getReceipt(client);
    const topicId=receipt.topicId.toString();
    console.log("Topic ID: "+topicId);
    
    //subscribing ot mirrir node 
    console.log("Subscribing to mirror node");
    subscribeToTopic(topicId);

    await new Promise(r=> setTimeout(r,5000));
    let timestamp = new Date("2024-12-27 10:00:00");
    for (const msg of messages){
        const enc=encrypt(msg,AES_KEY);

        const payload=JSON.stringify(enc);
        await new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(payload)
        .execute(client);

        console.log(`Sent: "${msg}" at ${timestamp.toISOString()}`);
        timestamp = new Date(timestamp.getTime() + 60*1000);

        await new Promise(r => setTimeout(r, 1500));

    }

    
}

function subscribeToTopic(topicId){
    new TopicMessageQuery()
    .setTopicId(topicId)
    .subscribe(
        client,
        error=>console.error("Mirrir error",error),
        message=>{
            const msgStr = Buffer.from(message.contents).toString("utf8");
                const encObj = JSON.parse(msgStr);

                const decrypted = decrypt(
                    encObj.encrypted,
                    AES_KEY,
                    encObj.iv,
                    encObj.tag
                );

                const ts = message.consensusTimestamp.toDate().toISOString();

                // Print Received
                console.log(`\n[RECEIVED at ${ts}] ${decrypted}`);

                if (decrypted.includes(FILTER_KEYWORD)) {
                    console.log("*** FILTER MATCH: Contains 'Hedera' ***");
                }
        }
    );
}

main();

