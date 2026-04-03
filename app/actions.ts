// actions.ts
'use server'
import { prisma } from './lib/prisma'
import { revalidatePath } from 'next/cache'

export async function saveRecord(data: any) {
  // 1. 患者情報の更新（インテーク）
  let patient = await prisma.patient.findFirst({ where: { name: data.name } })
  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        name: data.name,
        address: data.address,
        age: data.age,
        phone: data.phone,
        history: data.history,
        surgery: data.surgery,
        romLimit: data.romLimit,
        noTouch: data.noTouch,
        doctorNote: data.doctorNote,
        idealState: data.idealState,
      }
    })
  } else {
    await prisma.patient.update({
      where: { id: patient.id },
      data: {
        address: data.address, age: data.age, phone: data.phone,
        history: data.history, surgery: data.surgery,
        romLimit: data.romLimit, noTouch: data.noTouch,
        doctorNote: data.doctorNote, idealState: data.idealState
      }
    })
  }

  // 2. 施術記録の保存
  const record = await prisma.record.create({
    data: {
      patientId: patient.id,
      visitCount: parseInt(data.count),
      scoreShoulderUp: data.examData["肩上"].score,
      scoreShoulderTwist: data.examData["肩捻じれ"].side,
      scoreShoulderInL: data.examData["肩内旋左"],
      scoreShoulderInR: data.examData["肩内旋右"],
      scoreWaistHip: data.examData["ウエスト・お尻"],
      scoreAS: data.examData["AS"].score,
      scoreGreaterTro: data.examData["大転子"],
      scoreElbowRatio: data.examData["肘比率"],
      scoreShoulder: data.examData["肩"],
      scoreEar: data.examData["耳"],
      scoreFace: data.examData["顔"].score,
      counselingMemo: data.counselingMemo,
      treatmentMemo: data.treatmentMemo,
      drawingData: data.drawingData,
    }
  })

  revalidatePath('/')
  return { success: true }
}

export async function getRecords() {
  return await prisma.record.findMany({
    include: { patient: true },
    orderBy: { date: 'desc' },
  })
}