// api/sync.js
const crypto = require('crypto');

// Helper function to call Vercel KV REST API using native fetch
async function callKV(commandArray) {
    let url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    let token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    // Diagnostic logging to see available environment variables in Vercel logs
    console.log("[KV Info] Available env keys:", Object.keys(process.env).filter(k => k.includes("KV") || k.includes("REDIS")));

    if (!url || !token) {
        // Fallback: Parse REDIS_URL if available (for marketplace Redis integrations)
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            try {
                const parsedUrl = new URL(redisUrl);
                url = `https://${parsedUrl.hostname}`;
                token = parsedUrl.password || parsedUrl.username;
            } catch (e) {
                console.error("Failed to parse REDIS_URL:", e);
            }
        }
    }

    if (!url || !token) {
        throw new Error("Vercel KV environment variables (or REDIS_URL) are not configured in this deployment.");
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commandArray)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`KV API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        return data.result;
    } catch (err) {
        throw new Error(`Failed to fetch KV REST endpoint (${url}): ${err.message}`);
    }
}

// Simple SHA-256 hash helper
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = async (req, res) => {
    // Add CORS headers so local development client can talk to deployed Vercel API if needed
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const { action, username, password, clientState } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Thiếu Tên đăng nhập hoặc Mật khẩu.' });
        }

        const cleanUsername = username.trim().toLowerCase();
        const hashedPassword = hashPassword(password);

        const accountKey = `user:account:${cleanUsername}`;
        const dataKey = `user:data:${cleanUsername}`;

        // 1. Action: REGISTER
        if (action === 'register') {
            const exists = await callKV(['EXISTS', accountKey]);
            if (exists === 1) {
                return res.status(400).json({ success: false, message: 'Tên đăng nhập đã tồn tại!' });
            }

            // Save credentials and initialize empty planner state
            await callKV(['SET', accountKey, hashedPassword]);
            
            const defaultState = {
                events: [],
                tasks: [],
                habits: [],
                scratchpad: '',
                selectedWorkPlannerDay: 'monday',
                weeklyWorkTasks: {
                    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
                },
                lastUpdated: Date.now()
            };
            
            await callKV(['SET', dataKey, JSON.stringify(defaultState)]);
            return res.status(200).json({ success: true, message: 'Đăng ký tài khoản thành công!' });
        }

        // 2. Action: LOGIN or SYNC (Both require validating credentials)
        const storedHash = await callKV(['GET', accountKey]);
        if (!storedHash || storedHash !== hashedPassword) {
            return res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
        }

        // Fetch stored planner data
        const storedDataRaw = await callKV(['GET', dataKey]);
        let storedState = storedDataRaw ? JSON.parse(storedDataRaw) : null;

        // 2a. Action: LOGIN (just return the database state)
        if (action === 'login') {
            return res.status(200).json({ success: true, data: storedState });
        }

        // 2b. Action: SYNC (merge client and cloud states using timestamp)
        if (action === 'sync') {
            if (!clientState) {
                return res.status(400).json({ success: false, message: 'Thiếu dữ liệu đồng bộ từ Client.' });
            }

            const clientTime = clientState.lastUpdated || 0;
            const cloudTime = storedState ? (storedState.lastUpdated || 0) : 0;

            if (clientTime > cloudTime) {
                // Client has newer changes, update cloud database
                await callKV(['SET', dataKey, JSON.stringify(clientState)]);
                return res.status(200).json({ 
                    success: true, 
                    data: clientState, 
                    status: 'updated_cloud',
                    message: 'Đã cập nhật dữ liệu mới lên đám mây.' 
                });
            } else {
                // Cloud has newer (or equal) changes, send cloud data to client
                return res.status(200).json({ 
                    success: true, 
                    data: storedState, 
                    status: 'updated_client',
                    message: 'Đã tải dữ liệu mới nhất từ đám mây.' 
                });
            }
        }

        return res.status(400).json({ success: false, message: 'Hành động không hợp lệ.' });

    } catch (error) {
        console.error("Backend Error:", error);
        return res.status(500).json({ success: false, message: `Lỗi hệ thống: ${error.message}` });
    }
};
