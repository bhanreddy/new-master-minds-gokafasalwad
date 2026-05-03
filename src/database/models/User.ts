import { Model } from '@nozbe/watermelondb'
import { text, json } from '@nozbe/watermelondb/decorators'

export default class User extends Model {
    static table = 'users'

    @text('email') email!: string
    @text('first_name') firstName!: string
    @text('last_name') lastName!: string
    @text('display_name') displayName!: string
    @text('role') role!: string
    @text('photo_url') photoUrl?: string
    @json('permissions', (raw: any) => Array.isArray(raw) ? raw : []) permissions!: string[]
}
