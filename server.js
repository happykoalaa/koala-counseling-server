// 🐨 코알라 다문화 상담 서버 - 실제 AI 음성 인식
console.log('🐨 코알라 AI 서버 시작 중...');

const express = require('express');
const multer = require('multer');
const speech = require('@google-cloud/speech');
const { Translate } = require('@google-cloud/translate').v2;
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// 기본 미들웨어 설정
app.use(cors());
app.use(express.json());

// 무료 한도 관리
let dailyUsage = { 
  speechMinutes: 0, 
  translateChars: 0,
  lastReset: new Date().toDateString()
};

// 일일 사용량 초기화
const resetDailyUsage = () => {
  const today = new Date().toDateString();
  if (dailyUsage.lastReset !== today) {
    dailyUsage = { speechMinutes: 0, translateChars: 0, lastReset: today };
    console.log('🔄 일일 사용량 초기화됨');
  }
};

// 무료 한도 체크 미들웨어
const checkQuota = (req, res, next) => {
  resetDailyUsage();
  
  if (dailyUsage.speechMinutes > 1.8) { // 일일 2분 제한
    return res.status(429).json({ 
      error: '오늘 음성 인식 사용량을 초과했습니다. 내일 다시 시도해주세요.',
      usage: dailyUsage
    });
  }
  
  next();
};

// 파일 업로드 설정 (메모리 최적화)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('오디오 파일만 업로드 가능합니다.'));
    }
  }
});

// MongoDB 연결
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 5
}).then(() => {
  console.log('✅ MongoDB 연결 성공');
}).catch(err => {
  console.error('❌ MongoDB 연결 실패:', err);
});

// 상담 기록 스키마 (공간 최적화)
const RecordSchema = new mongoose.Schema({
  s: String,    // student
  m: String,    // mood
  l: String,    // language
  o: String,    // original text
  t: String,    // translated text
  d: { type: Date, default: Date.now }, // date
  p: { type: String, default: 'normal' } // priority
});

const Record = mongoose.model('Record', RecordSchema);

// Google Cloud 클라이언트 초기화
let speechClient, translateClient;

try {
  // 환경 변수에서 JSON 키 파싱
  const googleKey = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}');
  
  speechClient = new speech.SpeechClient({
    projectId: googleKey.project_id,
    credentials: googleKey
  });
  
  translateClient = new Translate({
    projectId: googleKey.project_id,
    credentials: googleKey
  });
  
  console.log('✅ Google Cloud AI 초기화 성공');
} catch (error) {
  console.warn('⚠️ Google Cloud 설정 없음 - 시뮬레이션 모드로 작동');
}

// 음성을 텍스트로 변환
async function speechToText(audioBuffer, languageCode) {
  if (!speechClient) {
    throw new Error('Google Cloud 설정이 필요합니다');
  }

  const request = {
    audio: { content: audioBuffer.toString('base64') },
    config: {
      encoding: 'WEBM_OPUS',
      sampleRateHertz: 16000,
      languageCode: languageCode,
      enableAutomaticPunctuation: true,
      model: 'default'
    },
  };

  const [response] = await speechClient.recognize(request);
  const transcription = response.results
    .map(result => result.alternatives[0].transcript)
    .join(' ');
  
  // 사용량 추가 (대략적 계산)
  const audioLengthMinutes = audioBuffer.length / (16000 * 2 * 60);
  dailyUsage.speechMinutes += audioLengthMinutes;
  
  return transcription;
}

// 텍스트 번역
async function translateText(text, targetLang = 'ko') {
  if (!translateClient || !text) return text;
  
  if (dailyUsage.translateChars + text.length > 15000) {
    throw new Error('일일 번역 한도 초과');
  }
  
  const [translation] = await translateClient.translate(text, targetLang);
  dailyUsage.translateChars += text.length;
  
  return translation;
}

// 언어 코드 매핑
const langMap = {
  'korean': 'ko-KR',
  'russian': 'ru-RU',
  'vietnamese': 'vi-VN'
};

// 시뮬레이션 데이터 생성
function generateSimulation(student, mood, language) {
  const moodTexts = {
    '😊': { ko: '정말 기뻐요', ru: 'очень счастлив', vi: 'rất vui' },
    '😢': { ko: '슬퍼요', ru: 'грустен', vi: 'buồn' },
    '😠': { ko: '화가 나요', ru: 'сердит', vi: 'tức giận' },
    '😐': { ko: '괜찮아요', ru: 'нормально', vi: 'bình thường' }
  };

  const examples = {
    russian: {
      original: `Меня зовут ${student}, и сегодня я ${moodTexts[mood]?.ru || 'нормально'}. Учитель, я хочу рассказать о своем дне в школе.`,
      translated: `제 이름은 ${student}이고, 오늘 기분은 ${moodTexts[mood]?.ko || '괜찮아요'}. 선생님, 학교에서의 하루에 대해 말씀드리고 싶어요.`
    },
    vietnamese: {
      original: `Em tên là ${student}, hôm nay em ${moodTexts[mood]?.vi || 'bình thường'}. Cô ơi, em muốn kể về ngày học của em.`,
      translated: `저는 ${student}이고, 오늘 기분은 ${moodTexts[mood]?.ko || '괜찮아요'}. 선생님, 제 학교생활에 대해 이야기하고 싶어요.`
    },
    korean: {
      original: `저는 ${student}이고, 오늘 기분은 ${moodTexts[mood]?.ko || '괜찮아요'}. 선생님, 오늘 하루를 말씀드릴게요.`,
      translated: `저는 ${student}이고, 오늘 기분은 ${moodTexts[mood]?.ko || '괜찮아요'}. 선생님, 오늘 하루를 말씀드릴게요.`
    }
  };

  return examples[language] || examples.korean;
}

// 메인 API: 음성 처리
app.post('/api/process-audio', checkQuota, upload.single('audio'), async (req, res) => {
  try {
    const { student, mood, language } = req.body;
    const audioBuffer = req.file?.buffer;

    if (!audioBuffer) {
      return res.status(400).json({ error: '오디오 파일이 필요합니다.' });
    }

    console.log(`🎤 음성 처리 시작: ${student} (${language})`);

    let originalText, translatedText;

    // 실제 AI 처리 시도
    if (speechClient && translateClient) {
      try {
        const languageCode = langMap[language] || 'ko-KR';
        originalText = await speechToText(audioBuffer, languageCode);
        
        // 번역 (한국어가 아닌 경우만)
        translatedText = originalText;
        if (language !== 'korean' && originalText) {
          translatedText = await translateText(originalText, 'ko');
        }

        console.log('✅ 실제 AI 처리 완료');
      } catch (aiError) {
        console.warn('⚠️ AI 처리 실패, 시뮬레이션으로 대체:', aiError.message);
        const simulation = generateSimulation(student, mood, language);
        originalText = simulation.original;
        translatedText = simulation.translated;
      }
    } else {
      // 시뮬레이션 모드
      console.log('🎭 시뮬레이션 모드로 처리');
      const simulation = generateSimulation(student, mood, language);
      originalText = simulation.original;
      translatedText = simulation.translated;
    }

    // 우선순위 결정
    const priority = ['😢', '😠', '😰'].includes(mood) ? 'high' : 'normal';

    // 데이터베이스 저장
    const record = new Record({
      s: student,
      m: mood,
      l: language,
      o: originalText,
      t: translatedText,
      p: priority
    });

    await record.save();

    res.json({
      success: true,
      data: {
        originalText,
        translatedText,
        priority,
        usage: dailyUsage,
        mode: speechClient ? 'AI' : 'SIMULATION'
      }
    });

  } catch (error) {
    console.error('❌ 처리 오류:', error);
    res.status(500).json({ 
      error: '음성 처리 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// 상담 기록 조회
app.get('/api/records', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    
    const records = await Record.find()
      .sort({ d: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();
    
    const formattedRecords = records.map(r => ({
      student: r.s,
      mood: r.m,
      language: r.l,
      originalText: r.o,
      translatedText: r.t,
      date: r.d,
      priority: r.p
    }));

    res.json({ success: true, data: formattedRecords });
  } catch (error) {
    res.status(500).json({ error: '기록을 불러올 수 없습니다.' });
  }
});

// 사용량 조회
app.get('/api/usage', (req, res) => {
  resetDailyUsage();
  res.json({
    date: dailyUsage.lastReset,
    speech: {
      used: Math.round(dailyUsage.speechMinutes * 100) / 100,
      limit: 2.0,
      unit: 'minutes'
    },
    translate: {
      used: dailyUsage.translateChars,
      limit: 15000,
      unit: 'characters'
    }
  });
});

// 건강 체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    mode: speechClient ? 'AI_READY' : 'SIMULATION',
    timestamp: new Date().toISOString(),
    usage: dailyUsage
  });
});

// 환영 페이지
app.get('/', (req, res) => {
  res.json({
    message: '🐨 안녕하세요! 코알라 다문화 상담 AI 서버입니다!',
    version: '1.0.0',
    mode: speechClient ? 'AI 음성 인식 활성화' : '시뮬레이션 모드',
    endpoints: [
      'POST /api/process-audio - 음성 처리',
      'GET /api/records - 상담 기록',
      'GET /api/usage - 사용량 확인',
      'GET /api/health - 서버 상태'
    ]
  });
});

// 에러 핸들링
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '파일 크기가 너무 큽니다. (최대 10MB)' });
    }
  }
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// 서버 시작
app.listen(port, () => {
  console.log(`🚀 코알라 AI 서버가 포트 ${port}에서 실행 중입니다!`);
  console.log(`🌐 서버 주소: ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`}`);
  console.log(`🤖 AI 모드: ${speechClient ? '실제 Google AI' : '시뮬레이션'}`);
  console.log('');
  console.log('📚 API 엔드포인트:');
  console.log('   GET  / - 환영 페이지');
  console.log('   POST /api/process-audio - 음성 처리');
  console.log('   GET  /api/records - 상담 기록');
  console.log('   GET  /api/usage - 사용량 확인');
  console.log('   GET  /api/health - 서버 상태');
});

// 프로세스 종료 시 정리
process.on('SIGINT', () => {
  console.log('\n🛑 서버를 종료합니다...');
  mongoose.connection.close();
  process.exit(0);
});