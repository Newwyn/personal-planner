# 🔮 Aura Planner - Your Personal Productivity Universe

Chào mừng bạn đến với **Aura Planner** - không gian làm việc cá nhân riêng tư và thẩm mỹ cao, kết hợp giữa quản lý lịch biểu khoa học, theo dõi thói quen, đồng hồ tập trung Pomodoro và bảng kế hoạch công việc tuần thông minh hỗ trợ xử lý ngôn ngữ tự nhiên (NLP AI).

Aura Planner được thiết kế theo chuẩn **PWA (Progressive Web App)**, giúp bạn dễ dàng cài đặt ứng dụng chạy độc lập, toàn màn hình và hoạt động hoàn toàn offline trên cả máy tính (Windows/macOS) lẫn điện thoại di động (Android/iOS).

---

## ✨ Các Tính Năng Nổi Bật

### 1. 📅 Aura Calendar (Lịch Biểu Aura)
* **Chế độ xem linh hoạt**: Hỗ trợ chuyển đổi nhanh giữa các chế độ xem **Tháng (Month)**, **Tuần (Week)** và **Ngày (Day)**.
* **Giao diện di động thông minh**: Trên màn hình điện thoại, lịch tháng tự động thu nhỏ các sự kiện thành các chấm tròn màu sắc tối giản (chống tràn chữ), đi kèm hộp thoại danh sách sự kiện chi tiết dạng bottom-sheet khi chạm vào mỗi ngày.
* **Tự động chuyển đổi**: Xem lịch tuần dạng cuộn dọc trực quan trên điện thoại di động.

### 2. 💼 Weekly Work Planner (Bảng Kế Hoạch Tuần Cực Nhanh)
* **AI Quick Task Parser**: Hỗ trợ nhập liệu nhanh bằng ngôn ngữ tự nhiên thông thường. Ví dụ: nhập `"Họp nhóm lúc 14h30 note chuẩn bị slide gấp"` $\rightarrow$ Hệ thống tự động phân tách tiêu đề: `"Họp nhóm"`, giờ làm: `"14:30"`, ghi chú: `"chuẩn bị slide"`, độ ưu tiên: `"Cao (high)"`.
* **Sao chép lịch đa ngày (Multi-day Copy)**: Hỗ trợ tick chọn nhiều ngày cùng lúc để sao chép gộp hoặc ghi đè thời gian biểu từ ngày hiện tại sang các ngày khác chỉ với 1 click.
* **Bộ lọc & Xóa nhanh**: Bộ lọc xem công việc (Tất cả, Chưa xong, Đã xong) và các nút xóa nhanh tiện lợi (Xóa hết ngày hôm nay, Xóa sạch cả tuần).

### 3. 🎯 Focus Widget & Habits Tracker (Tiện Ích Tập Trung & Thói Quen)
* **Focus Timer**: Đồng hồ đếm ngược Pomodoro (mặc định 25 phút tập trung, 5 phút giải lao) đi kèm thông báo âm thanh và cảnh báo trình duyệt.
* **Daily Habits**: Bảng tích chọn thói quen hàng ngày với hệ thống tính chuỗi ngày liên tục (streak) tự động.
* **Scratchpad**: Sổ tay ghi chú nhanh, tự động lưu trữ dữ liệu tức thời vào Local Storage.

### 4. 💾 Backup & Restore (Sao Lưu & Phục Hồi)
* Hỗ trợ xuất dữ liệu toàn bộ ứng dụng ra file định dạng `.json` và nhập lại dễ dàng để không bao giờ lo mất dữ liệu hoặc đồng bộ giữa các máy.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```bash
personal-planner/
├── index.html         # Giao diện chính của ứng dụng
├── styles.css         # Hệ thống CSS Responsive phong cách Glassmorphism
├── app.js             # Logic xử lý trạng thái (State), sự kiện & âm thanh Web Audio
├── package.json       # Khai báo thư viện (dependencies) cho môi trường Node.js
├── manifest.json      # Tệp cấu hình ứng dụng PWA (Tên, màu sắc, biểu tượng)
├── sw.js              # Service Worker tối ưu bộ nhớ cache offline
├── icon-192.png       # Biểu tượng ứng dụng kích thước 192x192px
├── icon-512.png       # Biểu tượng ứng dụng kích thước 512x512px
└── README.md          # Tài liệu hướng dẫn sử dụng (File này)
```

---

## 🛠️ Công Nghệ Sử Dụng

1. **HTML5 Semantic Elements** & **FontAwesome v6** (Biểu tượng cao cấp).
2. **Vanilla CSS3**: Sử dụng biến màu (variables), flexbox/grid responsive và các hiệu ứng chuyển động mịn (micro-animations).
3. **Vanilla JavaScript (ES6+)**: Xử lý logic nghiệp vụ và đồng bộ Local Storage không cần cơ sở dữ liệu cồng kềnh.
4. **Web Audio API**: Phát âm thanh hiệu ứng nhấn nút và chuông báo Pomodoro trực tiếp từ code, không cần tải file âm thanh ngoài.
5. **Service Worker & Cache Storage**: Đảm bảo app tải tức thì và chạy offline 100%.
6. **Node.js (Serverless API & Redis Client)**: API đồng bộ dữ liệu sử dụng Vercel Serverless Function, tự động nhận dạng kết nối REST (Vercel KV) hoặc TCP truyền thống (qua thư viện `redis` bằng biến `REDIS_URL`).

---

## 📲 Hướng Dẫn Cài Đặt Ứng Dụng (PWA)

### Trên Điện Thoại Android / iOS:
1. Đảm bảo điện thoại và máy chủ (PC hoặc link Vercel) chạy chung đường truyền.
2. Mở trình duyệt (Chrome trên Android hoặc Safari trên iOS) truy cập vào link web ứng dụng.
3. **Android (Chrome)**: Nhấn nút **Menu (3 chấm)** $\rightarrow$ chọn **Cài đặt ứng dụng (Install App)** hoặc **Thêm vào MH chính**.
4. **iOS (Safari)**: Nhấn biểu tượng **Chia sẻ (Share)** $\rightarrow$ chọn **Thêm vào MH chính (Add to Home Screen)**.

### Trên Máy Tính (PC / Laptop):
1. Truy cập link ứng dụng bằng trình duyệt Chrome hoặc Edge.
2. Trên thanh địa chỉ URL bên phải, nhấn vào nút hình **Màn hình có mũi tên tải xuống (Install)**.
3. Ứng dụng sẽ hiển thị độc lập dưới dạng một cửa sổ Widget không viền. Bạn có thể ghim vào Taskbar hoặc Desktop để mở nhanh.

---

## 🚀 Hướng Dẫn Deploy Lên GitHub và Vercel

Để đưa ứng dụng lên mạng internet chạy công khai và cài đặt lên điện thoại mọi lúc mọi nơi, hãy làm theo các bước sau:

### Bước 1: Khởi tạo Git và Push lên GitHub
1. Mở terminal tại thư mục dự án và chạy các lệnh:
   ```bash
   git init
   git add .
   git commit -m "Initial commit with PWA and Mobile optimizations"
   ```
2. Truy cập [github.com](https://github.com), đăng nhập và tạo một repository mới tên là `personal-planner` (để trống không tạo README hay .gitignore).
3. Copy link repository đó (dạng `https://github.com/username/personal-planner.git`) và gán vào git local:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/personal-planner.git
   git branch -M main
   git push -u origin main
   ```

### Bước 2: Deploy lên Vercel miễn phí
1. Truy cập [vercel.com](https://vercel.com) và đăng ký/đăng nhập bằng tài khoản GitHub của bạn.
2. Nhấn nút **Add New...** $\rightarrow$ chọn **Project**.
3. Tại danh sách repository, tìm `personal-planner` và nhấn **Import**.
4. Giữ nguyên cấu hình mặc định và nhấn **Deploy**.
5. Sau khi deploy thành công, bạn cần kết nối cơ sở dữ liệu để đồng bộ tài khoản:
   - **Cách 1 (Vercel KV - Khuyên dùng)**: Vào dự án trên Vercel $\rightarrow$ chọn tab **Storage** $\rightarrow$ chọn **KV** $\rightarrow$ nhấn **Connect**.
   - **Cách 2 (Redis Cloud hoặc Upstash bên ngoài)**: Kết nối database Redis và cấu hình biến môi trường `REDIS_URL` trong Project Settings.
6. Sau khi kết nối database, bạn truy cập tab **Deployments** $\rightarrow$ nhấn nút **3 chấm** ở bản build mới nhất $\rightarrow$ chọn **Redeploy** để áp dụng.
7. Dùng điện thoại hoặc máy tính khác truy cập vào link HTTPS của bạn để trải nghiệm đồng bộ!
