const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

dotenv.config({ path: path.resolve('/Users/aryan/Documents/projects/queue-management-system/hacksagon/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase URL or Key is missing.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const names = ["Aarav","Aarush","Aaryan","Aditya","Akash","Akshay","Aman","Amar","Amit","Anand","Anil","Anirudh","Ankit","Ankur","Arjun","Arnav","Arun","Ashish","Ashok","Atul","Ayush","Balaji","Bharat","Bhaskar","Chetan","Chirag","Deepak","Dev","Devendra","Dhanush","Dhruv","Dilip","Dinesh","Eshwar","Ganesh","Gaurav","Girish","Gopal","Govind","Gurpreet","Harish","Harsha","Hemant","Hemanth","Himanshu","Indrajit","Irfan","Ishaan","Jagadish","Jagdish","Jai","Jatin","Javed","Jay","Jayant","Jeevan","Kailash","Kamal","Karan","Karthik","Karthikeyan","Keshav","Kiran","Krishna","Kunal","Lakshman","Lokesh","Madhav","Mahesh","Manish","Manoj","Mayank","Mihir","Mohit","Mukesh","Murali","Nagaraj","Naresh","Naveen","Nikhil","Niraj","Nitin","Omkar","Pankaj","Parth","Pavan","Pradeep","Prakash","Pranav","Prashant","Pratik","Prem","Rahul","Raj","Rajat","Rajesh","Rajiv","Rakesh","Ram","Ramesh","Ranjit","Ravi","Rohit","Roshan","Sagar","Sahil","Sandeep","Sanjay","Santosh","Sarvesh","Satish","Shankar","Shashank","Shiv","Shivam","Shivraj","Shyam","Siddharth","Sohan","Somesh","Sourav","Subhash","Sudarshan","Sujit","Sumit","Suraj","Suresh","Sushil","Tarun","Tejas","Uday","Umesh","Upendra","Utkarsh","Varun","Vasant","Venkatesh","Vijay","Vikas","Vikram","Vinay","Vineet","Vinit","Vishal","Vishnu","Vivek","Yash","Yogesh","Aarti","Aasha","Aditi","Alka","Amrita","Ananya","Anita","Anjali","Ankita","Anushka","Archana","Arpita","Arti","Asha","Ashwini","Avani","Chandni","Charu","Deepa","Deepika","Divya","Durga","Eesha","Ekta","Gauri","Gayatri","Geeta","Hema","Hina","Indira","Isha","Ishita","Jaya","Jyoti","Kajal","Kalpana","Kavita","Kiran","Komal","Kritika","Kusum","Lakshmi","Madhu","Madhuri","Manisha","Meena","Meera","Megha","Mohini","Monika","Naina","Namrata","Neelam","Neha","Nikita","Nisha","Nitu","Pallavi","Pooja","Poonam","Pratibha","Preeti","Priya","Priyanka","Radha","Rashmi","Reema","Renu","Richa","Ritu","Riya","Roshni","Sadhana","Sakshi","Saloni","Sanjana","Sarika","Savita","Seema","Shaila","Shalini","Shanta","Sharda","Sheetal","Shivani","Shraddha","Shruti","Shweta","Simran","Sneha","Sonia","Sudha","Sujata","Sunita","Sushma","Swati","Tanvi","Trisha","Uma"];
let doctorIndex = 0;

function getDocs(count) {
  const docs = [];
  for(let i=0; i<count; i++){
    if(doctorIndex >= names.length) throw new Error("Not enough doctors!");
    docs.push(names[doctorIndex++]);
  }
  return docs;
}

function randId() { return crypto.randomUUID(); }

// Add real hospital data here in the format:
// { name, city, state, address, pincode, phone, email, departments: [{ name, doctors }], counters: [{ n, c }] }
const hospitals = [];

async function tryInsert(table, data) {
    const { data: result, error } = await supabase.from(table).insert(data).select().single();
    if (error) { throw error; }
    return result;
}

async function seed() {
  console.log("Starting seed process...");

  for (const h of hospitals) {
    const hId = randId();
    console.log(`Inserting hospital ${h.name}`);
    await supabase.from('hospitals').insert({
      id: hId, name: h.name, address: h.address, city: h.city, state: h.state, pincode: h.pincode, phone: h.phone, email: h.email, departments: h.departments.map(d => d.name)
    });

    let deptIdForCounters = null;
    let counterNum = 1;

    for (const d of h.departments) {
      const dId = randId();
      await supabase.from('departments').insert({
        id: dId, hospital_id: hId, name: d.name, description: `${d.name} Department`, floor: '1'
      });
      if (!deptIdForCounters) deptIdForCounters = dId;

      const doctorNames = getDocs(d.doctors);
      for (const docName of doctorNames) {
        await supabase.from('doctors').insert({
          id: randId(),
          hospital_id: hId, department_id: dId, name: `Dr. ${docName}`, email: `${docName.toLowerCase()}@${h.name.replace(/\\s+/g,'').toLowerCase()}.com`, phone: "1234567890", specialization: d.name, qualification: 'MBBS, MD', experience: 5, rating: 0, total_ratings: 0
        });
      }
    }

    // Add counters to the first department
    for (const c of h.counters) {
      for(let i=0; i<c.c; i++){
        await supabase.from('counters').insert({
           id: randId(), hospital_id: hId, department_id: deptIdForCounters, counter_number: counterNum++
        });
      }
    }
    console.log(`Completed hospital ${h.name}`);
  }

  console.log("Seeding completed successfully.");
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
