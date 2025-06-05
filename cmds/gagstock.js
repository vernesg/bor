const fs = require("fs");
const axios = require("axios");
const { sendMessage } = require("../handles/sendMessage");

const activeSessions = new Map();

module.exports = {
    name: "gagstock",
    usePrefix: false,
    usage: "gagstock on | gagstock off",
    version: "1.0",
    admin: false,
    cooldown: 10,
    description: "Track Grow A Garden stock + weather every 30s, honeyStock every 1m (notifies only if updated)",

    execute: async ({ senderId, args, pageAccessToken }) => {
        const action = args[0]?.toLowerCase();

        if (action === "off") {
            const session = activeSessions.get(senderId);
            if (session) {
                clearInterval(session.interval);
                activeSessions.delete(senderId);
                return await sendMessage(senderId, { text: "🛑 Gagstock tracking stopped." }, pageAccessToken);
            } else {
                return await sendMessage(senderId, { text: "⚠️ You don't have an active gagstock session." }, pageAccessToken);
            }
        }

        if (action !== "on") {
            return await sendMessage(senderId, {
                text: "📌 Usage:\n• `gagstock on` to start tracking\n• `gagstock off` to stop tracking"
            }, pageAccessToken);
        }

        if (activeSessions.has(senderId)) {
            return await sendMessage(senderId, {
                text: "📡 You're already tracking Gagstock. Use `gagstock off` to stop."
            }, pageAccessToken);
        }

        await sendMessage(senderId, {
            text: "✅ Gagstock tracking started! You'll be notified when stock or weather changes."
        }, pageAccessToken);

        const getPHTime = (timestamp) =>
            new Date(timestamp).toLocaleString("en-PH", {
                timeZone: "Asia/Manila",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
                weekday: "short",
            });

        const sessionData = {
            interval: null,
            lastCombinedKey: null,
            lastMessage: ""
        };

        const fetchAll = async () => {
            try {
                const [gearSeedRes, eggRes, weatherRes, honeyStockRes] = await Promise.all([
                    axios.get("https://growagardenstock.com/api/stock?type=gear-seeds"),
                    axios.get("https://growagardenstock.com/api/stock?type=egg"),
                    axios.get("https://growagardenstock.com/api/stock/weather"),
                    axios.get("http://65.108.103.151:22377/api/stocks?type=honeyStock")
                ]);

                const gearSeed = gearSeedRes.data;
                const egg = eggRes.data;
                const weather = weatherRes.data;
                const honey = honeyStockRes.data;

                const combinedKey = JSON.stringify({
                    gear: gearSeed.gear,
                    seeds: gearSeed.seeds,
                    egg: egg.egg,
                    weather: weather.updatedAt,
                    honey: honey.updatedAt,
                    honeyList: honey.honeyStock
                });

                if (combinedKey === sessionData.lastCombinedKey) return;
                sessionData.lastCombinedKey = combinedKey;

                const now = Date.now();

                const gearTime = getPHTime(gearSeed.updatedAt);
                const gearReset = Math.max(300 - Math.floor((now - gearSeed.updatedAt) / 1000), 0);
                const gearResetText = `${Math.floor(gearReset / 60)}m ${gearReset % 60}s`;

                const eggTime = getPHTime(egg.updatedAt);
                const eggReset = Math.max(600 - Math.floor((now - egg.updatedAt) / 1000), 0);
                const eggResetText = `${Math.floor(eggReset / 60)}m ${eggReset % 60}s`;

                const weatherIcon = weather.icon || "🌦️";
                const weatherDesc = weather.currentWeather || "Unknown";
                const weatherBonus = weather.cropBonuses || "N/A";

                const honeyStocks = honey.honeyStock || [];
                const honeyText = honeyStocks.length
                    ? honeyStocks.map((h) => `🍯 ${h.name}: ${h.value}`).join("\n")
                    : "No honey stock available.";

                const message = `🌾 𝗚𝗿𝗼𝘄 𝗔 𝗚𝗮𝗿𝗱𝗲𝗻 — 𝗡𝗲𝘄 𝗦𝘁𝗼𝗰𝗸 & 𝗪𝗲𝗮𝘁𝗵𝗲𝗿\n\n` +
                    `🛠️ 𝗚𝗲𝗮𝗿:\n${gearSeed.gear?.join("\n") || "No gear."}\n\n` +
                    `🌱 𝗦𝗲𝗲𝗱𝘀:\n${gearSeed.seeds?.join("\n") || "No seeds."}\n\n` +
                    `🥚 𝗘𝗴𝗴𝘀:\n${egg.egg?.join("\n") || "No eggs."}\n\n` +
                    `🌤️ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${weatherIcon} ${weatherDesc}\n🪴 𝗕𝗼𝗻𝘂𝘀: ${weatherBonus}\n\n` +
                    `📅 𝗚𝗲𝗮𝗿/𝗦𝗲𝗲𝗱 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${gearTime}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${gearResetText}\n\n` +
                    `📅 𝗘𝗴𝗴 𝗨𝗽𝗱𝗮𝘁𝗲𝗱: ${eggTime}\n🔁 𝗥𝗲𝘀𝗲𝘁 𝗶𝗻: ${eggResetText}\n\n` +
                    `📦 𝗛𝗼𝗻𝗲𝘆 𝗦𝘁𝗼𝗰𝗸:\n${honeyText}`;

                if (message !== sessionData.lastMessage) {
                    sessionData.lastMessage = message;
                    await sendMessage(senderId, { text: message }, pageAccessToken);
                }

            } catch (err) {
                console.error(`❌ Gagstock Error for ${senderId}:`, err.message);
            }
        };

        sessionData.interval = setInterval(fetchAll, 30 * 1000);
        activeSessions.set(senderId, sessionData);
        await fetchAll();
    }
};
