# منصة حلقات عاشور بخاري - نسخة نظيفة مستقرة

هذه نسخة أولى نظيفة للربط مع قاعدة Neon الحالية، بدون Neon Auth في المرحلة الأولى.
تستخدم رمز دخول بسيط من متغير بيئة اسمه ADMIN_ACCESS_CODE حتى نتجنب مشكلات المصادقة القديمة.

## متغيرات Vercel المطلوبة

1. DATABASE_URL
- رابط قاعدة Neon.
- اجعله Secret وعلى All Environments.

2. ADMIN_ACCESS_CODE
- أي رمز دخول تختاره، مثل رقم من 6 خانات.
- اجعله Secret وعلى All Environments.

## الاختبار بعد النشر

- افتح /api/status
- يجب أن تظهر: configured true و database connected.
- افتح الصفحة الرئيسية وأدخل رمز الدخول.
