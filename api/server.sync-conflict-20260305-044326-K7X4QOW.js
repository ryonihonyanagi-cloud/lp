// pilotAI コンタクトフォーム → Notion DB 転記サーバー
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');

const app = express();
const PORT = process.env.PORT || 3001;

// Notion クライアント初期化
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'pilotAI Contact API' });
});

// お問い合わせ受付エンドポイント
app.post('/api/contact', async (req, res) => {
  try {
    const { name, company, email, phone, plan, message } = req.body;

    // バリデーション
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: '必須項目（名前、メール、相談内容）を入力してください'
      });
    }

    // プラン名の変換
    const planLabels = {
      consulting: 'AIコンサルティング',
      development: '社内ツール開発',
      undecided: '未定 / 相談希望'
    };

    // 現在日時（ISO 8601）
    const now = new Date().toISOString();

    // Notion DBのプロパティ構成（実際のDB列名に完全一致）
    // Aa 件名 | お名前 | ステータス | メールアドレス | 受信日時 | ご相談内容 | 電話番号 | 会社名 | 興味のあるプラン
    const properties = {
      // タイトル列（件名）
      '件名': {
        title: [{ text: { content: `${name}様からのお問い合わせ` } }]
      },
      // お名前（リッチテキスト）
      'お名前': {
        rich_text: [{ text: { content: name } }]
      },
      // メールアドレス（メール型）
      'メールアドレス': {
        email: email
      },
      // 会社名（リッチテキスト）
      '会社名': {
        rich_text: [{ text: { content: company || '' } }]
      },
      // 電話番号（電話番号型）
      '電話番号': {
        phone_number: phone || null
      },
      // ご相談内容（リッチテキスト）
      'ご相談内容': {
        rich_text: [{ text: { content: message } }]
      },
      // 興味のあるプラン（セレクト型）
      '興味のあるプラン': {
        select: { name: planLabels[plan] || '未定 / 相談希望' }
      },
      // ステータス（ステータス型）
      'ステータス': {
        status: { name: '未対応' }
      },
      // 受信日時（日付型）
      '受信日時': {
        date: { start: now }
      }
    };

    const response = await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties
    });

    console.log(`[${now}] 問い合わせ受付: ${name} (${email})`);

    res.json({
      success: true,
      message: 'お問い合わせを受け付けました'
    });

  } catch (error) {
    console.error('Notion API エラー:', error.message);

    if (error.code === 'validation_error') {
      console.error('ヒント: Notion DBのプロパティ名を確認してください');
      console.error('詳細:', JSON.stringify(error.body || error.message));
    }

    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました。しばらく経ってから再度お試しください。'
    });
  }
});

app.listen(PORT, () => {
  console.log(`pilotAI Contact API running on port ${PORT}`);
  console.log(`Database ID: ${DATABASE_ID ? DATABASE_ID.slice(0, 8) + '...' : 'NOT SET'}`);
});
