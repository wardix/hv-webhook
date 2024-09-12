import { type Consumer } from 'nats'
import axios from 'axios'
import FormData from 'form-data'
import { COMPANY_CONFIG, GRACE_PERIOD_SECOND } from './config'
import { retrieveBearerToken } from './token'

const parsedCompanyConfig = JSON.parse(COMPANY_CONFIG)

export const processEventMessages = async (consumer: Consumer) => {
  const eventBatch = await consumer.fetch({
    max_messages: 128,
    expires: 1000,
  })

  const currentTime = new Date()

  for await (const eventMessage of eventBatch) {
    const companyIdHeader = eventMessage
      .headers!.get('Company-ID')
      ?.replaceAll('-', '')
    if (!companyIdHeader || !(companyIdHeader in parsedCompanyConfig)) {
      eventMessage.ack()
      continue
    }

    const bearerToken = await retrieveBearerToken(companyIdHeader)
    const attendanceApiUrl =
      parsedCompanyConfig[companyIdHeader].attendance_api_url

    const eventDateTime = eventMessage.headers!.get('Event-DateTime')
    const eventTimestamp = new Date(eventDateTime)
    const employeeId = eventMessage.headers!.get('Event-EmployeeNoString')
    const deviceName = eventMessage.headers!.get('Event-DeviceName')

    const isEventExpired =
      currentTime.getTime() - eventTimestamp.getTime() >
      Number(GRACE_PERIOD_SECOND) * 1000

    if (isEventExpired) {
      console.log(`Event ignored: ${eventDateTime}`)
    } else {
      const formData = new FormData()
      formData.append('photo', Buffer.from(eventMessage.data), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      })
      formData.append('date_time', eventDateTime)
      formData.append('employee_id', employeeId)
      formData.append('gate_name', deviceName)

      console.log(
        `Processing event: ${eventDateTime} | Employee: ${employeeId} | Device: ${deviceName}`,
      )

      try {
        const response = await axios.post(attendanceApiUrl, formData, {
          headers: {
            ...formData.getHeaders(),
            Authorization: `Bearer ${bearerToken}`,
          },
        })
        console.log('Response:', response.data)
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error(
            `Axios error occurred: ${error.response?.status} - ${error.response?.statusText}`,
            error.response?.data,
          )
        } else {
          console.error('Unexpected error:', error)
        }
      }
    }

    eventMessage.ack()
  }
}
