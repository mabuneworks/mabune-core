'use server'

import { prisma } from './lib/prisma'
import { revalidatePath } from 'next/cache'

export async function saveRecord(formData: any) {
  // 1. まず患者さんを探す。いなければ新しく作る（簡易版）
  let patient = await prisma.patient.findFirst({
    where: { name: formData.name }
  })

  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: formData.name,
        // ここに住所や生年月日も追加可能
      }
    })
  }

  // 2. 金庫（Recordテーブル）に保存する
  const record = await prisma.record.create({
    data: {
      patientId: patient.id,
      visitCount: parseInt(formData.count),
      scoreShoulderUp: formData.examData["肩上"].score,
      scoreShoulderTwist: formData.examData["肩捻じれ"].side,
      scoreShoulderInL: formData.examData["肩内旋左"],
      scoreShoulderInR: formData.examData["肩内旋右"],
      scoreWaistHip: formData.examData["ウエスト・お尻"],
      scoreAS: formData.examData["AS"].score,
      scoreGreaterTro: formData.examData["大転子"],
      scoreElbowRatio: formData.examData["肘比率"],
      scoreShoulder: formData.examData["肩"],
      scoreEar: formData.examData["耳"],
      scoreFace: formData.examData["顔"].score,
      // メモなど
      memo: `首:${formData.extraExamData["首"].side}${formData.extraExamData["首"].pos}, 腰:${formData.extraExamData["腰"].side}${formData.extraExamData["腰"].pos}`,
    }
  })

  console.log("金庫に保存しました:", record)
  revalidatePath('/') // 画面を更新
  return { success: true, recordId: record.id }
}export async function getRecords() {
  const records = await prisma.record.findMany({
    include: { patient: true }, // 患者さんの名前も一緒に持ってくる
    orderBy: { date: 'desc' },   // 新しい順に並べる
    take: 10                    // とりあえず最新10件
  })
  return records
}