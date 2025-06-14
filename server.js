// server.js - CORS 문제 해결 버전
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// ✅ CORS 설정 - 모든 도메인 허용
app.use(cors({
  origin: '*', // 모든 도메인에서 접근 허용
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false // 쿠키는 사용하지 않음
}));

// ✅ 추가 CORS 헤더 설정 (보험용)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // OPTIONS 요청 처리 (preflight)
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 기본 미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 환영 메시지
app.get('/', (req, res) => {
  res.json({
    message: '🐨 안녕하세요! 코알라 다문화 상담 서버입니다!',
    version: '1.0.0',
    status: 'running',
    cors: 'enabled', // CORS 활성화 표시
    timestamp: new Date().toISOString()
  });
});

// ✅ 건강 체크 API (CORS 테스트용)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '서버가 정상 작동 중입니다',
    cors: 'working', // CORS 작동 확인
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    server: 'Render',
    environment: process.env.NODE_ENV || 'development'
  });
});

// ✅ 테스트용 API (CORS 테스트)
app.post('/api/test-audio', (req, res) => {
  console.log('✅ CORS 테스트 요청 받음:', req.body);
  
  // CORS 헤더 추가 확인
  res.header('Access-Control-Allow-Origin', '*');
  
  setTimeout(() => {
    res.json({
      success: true,
      message: '🎉 CORS 문제 해결 완료!',
      data: {
        originalText: '테스트 음성입니다',
        translatedText: '테스트 음성입니다',
        language: 'korean',
        timestamp: new Date().toISOString(),
        cors_status: 'working'
      }
    });
  }, 2000);
});

// ✅ 실제 음성 처리 API (준비 단계)
app.post('/api/process-audio', (req, res) => {
  console.log('🎤 음성 처리 요청 받음');
  
  // CORS 헤더 확인
  res.header('Access-Control-Allow-Origin', '*');
  
  // 현재는 시뮬레이션 응답
  setTimeout(() => {
    res.json({
      success: true,
      message: '음성 처리 완료 (시뮬레이션)',
      data: {
        originalText: '안녕하세요, 저는 테스트 학생입니다.',
        translatedText: '안녕하세요, 저는 테스트 학생입니다.',
        language: 'korean',
        priority: 'normal',
        timestamp: new Date().toISOString(),
        processing_mode: 'simulation'
      }
    });
  }, 3000);
});

// 404 에러 처리
app.use('*', (req, res) => {
  res.status(404).json({
    error: '요청하신 API를 찾을 수 없습니다',
    availableRoutes: [
      'GET /',
      'GET /api/health',
      'POST /api/test-audio',
      'POST /api/process-audio'
    ],
    cors: 'enabled'
  });
});

// 에러 처리 미들웨어
app.use((error, req, res, next) => {
  console.error('서버 오류:', error);
  
  // CORS 헤더 추가
  res.header('Access-Control-Allow-Origin', '*');
  
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다',
    message: error.message,
    cors: 'enabled'
  });
});

// 서버 시작
app.listen(port, () => {
  console.log(`🚀 코알라 서버가 포트 ${port}에서 실행 중입니다!`);
  console.log(`📝 API 문서: http://localhost:${port}`);
  console.log(`💚 건강 체크: http://localhost:${port}/api/health`);
  console.log(`🔒 CORS 설정: 모든 도메인 허용`);
  console.log(`🌐 Render URL: https://koala-counseling-server.onrender.com`);
  console.log('');
  console.log('✅ CORS 문제 해결 완료!');
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n🛑 서버를 종료합니다...');
  process.exit(0);
});
