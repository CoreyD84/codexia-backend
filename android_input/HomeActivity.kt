@file:Root
class HomeActivity : AppCompatActivity() {
    // @dependency:SprintRadioManager
    fun goToProfile() {
        val intent = Intent(this, ProfileActivity::class.java)
        startActivity(intent)
    }
}
