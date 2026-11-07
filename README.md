# Production Management – Wire Harness (PWA prototype)

## Thành phần
- `index.html`: giao diện và logic bản thử nghiệm.
- `manifest.webmanifest`: cấu hình cài đặt PWA.
- `sw.js`: cache tài nguyên cơ bản để mở lại ứng dụng khi mất mạng.

## Chạy thử trên máy tính
1. Giải nén thư mục.
2. Mở bằng máy chủ web tĩnh (không nên mở trực tiếp `file://` nếu muốn thử PWA).
3. Có thể dùng VS Code + Live Server hoặc GitHub Pages.
4. Tài khoản demo: `ADMIN / admin123`; `TL01 / 123456`.

## Cài trên Android/iOS
- Đưa các file lên hosting có HTTPS (ví dụ GitHub Pages).
- Android Chrome: mở URL → menu → Install app / Add to Home screen.
- iPhone Safari: mở URL → Share → Add to Home Screen.

## Giới hạn bắt buộc phải biết
Đây là frontend prototype. Dữ liệu đang lưu trong LocalStorage của từng trình duyệt/thiết bị; không tự đồng bộ qua nhiều máy. Tài khoản/mật khẩu demo cũng nằm ở phía trình duyệt, vì vậy **không dùng bản này cho dữ liệu sản xuất thật hoặc thông tin nhạy cảm**.

Để vận hành thật cần giai đoạn backend:
- API có xác thực (ví dụ Supabase Auth hoặc backend riêng).
- Cơ sở dữ liệu trung tâm (PostgreSQL/Supabase).
- Quy tắc phân quyền được kiểm tra ở server/database, không chỉ ẩn nút trên giao diện.
- Đồng bộ có xử lý xung đột, nhật ký chỉnh sửa, sao lưu và khôi phục.
- Kiểm thử nhiều người dùng cùng ghi dữ liệu và kiểm thử trên thiết bị Android/iOS thực tế.

## Công thức tính hiệu suất trong bản thử nghiệm
Phút chuẩn cần đạt = phút làm việc × số người × hiệu suất mục tiêu / 100.
Số bộ = phút chuẩn cần đạt / phút chuẩn cho một bộ.
Cần xác nhận cách định nghĩa thời gian chuẩn của nhà máy trước khi dùng số liệu chính thức.
